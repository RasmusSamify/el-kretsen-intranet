/**
 * Engångsoperation: re-chunka hela kunskapsbasen i två nivåer (small + large)
 * och fyll kb_chunks_v2. Kör som blue/green — original kb_chunks rörs aldrig.
 *
 * Pipeline per filename:
 *   1. Hämta alla v1-chunks ordnade på chunk_index
 *   2. Reconstruct källtext genom att de-dupa overlap
 *   3. Splitta hierarkiskt — large (~2500) + small (~400), sentence-aware overlap
 *   4. Insert large chunks → få UUIDs
 *   5. Insert small chunks med parent_id → linkning klar
 *   6. Embed både small och large (med contextualized prefix från v1.3.0)
 *   7. Extrahera metadata via samma regex-extractor som ingest-pipelines
 *
 * Total uppskattad volym: ~800 large + ~5000 small = ~5800 embeddings.
 *
 * Kör:
 *   npx tsx scripts/rechunk-hierarchical.ts [--limit N] [--dry]
 *
 *   --limit N   bara N första filnamnen (för smoke test)
 *   --dry       räkna, splittra, men inget DB-skriv eller Voyage-anrop
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reconstructSource, splitHierarchical } from './_lib/hierarchical-chunker';
import { extractMetadata } from '../netlify/functions/_shared/extractMetadata';
import { embeddingInput } from '../netlify/functions/_shared/contextPrefix';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  console.warn('Ingen .env.local hittades.');
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://jnwatbnkdzuyhqmcerej.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY!;
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBEDDING_MODEL = 'voyage-3';
const EMBED_BATCH = 50;

const args = process.argv.slice(2);
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? parseInt(args[i + 1], 10) : null;
})();
const DRY = args.includes('--dry');
const CLEAR = args.includes('--clear');

if (!SERVICE_KEY || !VOYAGE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY eller VOYAGE_API_KEY saknas.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface V1Row {
  filename: string;
  chunk_index: number;
  text: string;
  source_category: string | null;
  quality_score: number | null;
}

async function fetchAllV1Chunks(): Promise<Map<string, V1Row[]>> {
  const grouped = new Map<string, V1Row[]>();
  const PAGE = 500;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('kb_chunks')
      .select('filename, chunk_index, text, source_category, quality_score')
      .order('filename', { ascending: true })
      .order('chunk_index', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch v1: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as V1Row[]) {
      if (!grouped.has(row.filename)) grouped.set(row.filename, []);
      grouped.get(row.filename)!.push(row);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return grouped;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  let attempt = 0;
  while (attempt < 5) {
    const res = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts, input_type: 'document' }),
    });
    if (res.ok) {
      const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
      return data.data.map((d) => d.embedding);
    }
    if (res.status === 429 || res.status === 503) {
      const wait = Math.min(60_000, 2 ** attempt * 5_000);
      console.warn(`  Voyage ${res.status} — väntar ${wait / 1000}s (attempt ${attempt + 1})`);
      await sleep(wait);
      attempt++;
      continue;
    }
    throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error('Voyage: gav upp efter 5 retries');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface RowToInsert {
  filename: string;
  chunk_index: number;
  parent_id: string | null;
  chunk_level: 'small' | 'large';
  text: string;
  token_count: number;
  embedding: number[];
  source_category: string | null;
  quality_score: number | null;
  law_ref: string | null;
  paragraph_ref: string | null;
  section: string | null;
}

async function processSource(filename: string, v1Rows: V1Row[]): Promise<{ large: number; small: number }> {
  // 1+2: reconstruct källtext
  const original = reconstructSource(v1Rows.map((r) => r.text));
  if (!original.trim()) return { large: 0, small: 0 };

  // 3: split hierarkiskt
  const hier = splitHierarchical(original);
  const sourceCategory = v1Rows[0]?.source_category ?? null;
  const qualityScore = v1Rows[0]?.quality_score ?? null;

  if (DRY) {
    return { large: hier.length, small: hier.reduce((a, b) => a + b.smalls.length, 0) };
  }

  // 4: bygg large + embedda
  const largeTexts = hier.map((h) => h.text);
  const largeEmbeddings = await embedAll(filename, largeTexts, hier.map((h) => h.index));
  const largeRows: Omit<RowToInsert, 'parent_id'>[] = hier.map((h, i) => {
    const meta = extractMetadata(h.text);
    return {
      filename,
      chunk_index: h.index,
      chunk_level: 'large',
      text: h.text,
      token_count: Math.round(h.text.length / 4),
      embedding: largeEmbeddings[i],
      source_category: sourceCategory,
      quality_score: qualityScore,
      ...meta,
    };
  });

  const { data: insertedLarge, error: largeErr } = await supabase
    .from('kb_chunks_v2')
    .insert(largeRows.map((r) => ({ ...r, parent_id: null })))
    .select('id, chunk_index');
  if (largeErr) throw new Error(`insert large ${filename}: ${largeErr.message}`);

  const parentIdByIndex = new Map<number, string>();
  for (const row of insertedLarge as Array<{ id: string; chunk_index: number }>) {
    parentIdByIndex.set(row.chunk_index, row.id);
  }

  // 5+6: small chunks med parent_id, embedda
  const allSmalls = hier.flatMap((h) => h.smalls);
  const smallTexts = allSmalls.map((s) => s.text);
  const smallEmbeddings = await embedAll(
    filename,
    smallTexts,
    allSmalls.map((s) => s.index),
  );
  let runningSmallIndex = 0;
  const smallRows: RowToInsert[] = allSmalls.map((s, i) => {
    const meta = extractMetadata(s.text);
    return {
      filename,
      chunk_index: runningSmallIndex++,
      parent_id: parentIdByIndex.get(s.parentIndex) ?? null,
      chunk_level: 'small',
      text: s.text,
      token_count: Math.round(s.text.length / 4),
      embedding: smallEmbeddings[i],
      source_category: sourceCategory,
      quality_score: qualityScore,
      ...meta,
    };
  });

  const { error: smallErr } = await supabase.from('kb_chunks_v2').insert(smallRows);
  if (smallErr) throw new Error(`insert small ${filename}: ${smallErr.message}`);

  return { large: largeRows.length, small: smallRows.length };
}

async function embedAll(filename: string, texts: string[], indices: number[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const slice = texts.slice(i, i + EMBED_BATCH);
    const indexSlice = indices.slice(i, i + EMBED_BATCH);
    const inputs = slice.map((t, k) => embeddingInput(filename, indexSlice[k], t));
    const res = await embedBatch(inputs);
    embeddings.push(...res);
  }
  return embeddings;
}

async function main() {
  console.log(`[rechunk-hierarchical] dry=${DRY} limit=${LIMIT ?? 'all'} clear=${CLEAR}`);

  if (CLEAR && !DRY) {
    console.log('Rensar kb_chunks_v2...');
    const { error } = await supabase.from('kb_chunks_v2').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`clear: ${error.message}`);
  }

  console.log('Hämtar v1-chunks...');
  const grouped = await fetchAllV1Chunks();
  let filenames = [...grouped.keys()];
  if (LIMIT) filenames = filenames.slice(0, LIMIT);
  console.log(`Bearbetar ${filenames.length} källor (${[...grouped.values()].reduce((a, b) => a + b.length, 0)} v1-chunks totalt).`);

  let processed = 0;
  let totalLarge = 0;
  let totalSmall = 0;
  const startedAt = Date.now();

  for (const filename of filenames) {
    const rows = grouped.get(filename)!;
    try {
      const { large, small } = await processSource(filename, rows);
      totalLarge += large;
      totalSmall += small;
      processed++;
      const eta = ((Date.now() - startedAt) / processed) * (filenames.length - processed);
      console.log(
        `[${processed}/${filenames.length}] ${filename.slice(0, 60)} → ${large}L + ${small}S  (ETA ${Math.round(eta / 1000)}s)`,
      );
    } catch (e) {
      console.error(`  FEL i ${filename}: ${(e as Error).message}`);
    }
  }

  console.log(
    `\nKlar. ${processed} källor bearbetade. Totalt ${totalLarge} large + ${totalSmall} small chunks i kb_chunks_v2.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
