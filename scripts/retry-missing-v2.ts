/**
 * Retry-skript: hittar källor som finns i kb_chunks (v1) men saknar
 * motsvarande chunks i kb_chunks_v2 (v2). Kör same pipeline som
 * rechunk-hierarchical men bara för dessa.
 *
 * Används efter att rechunk-hierarchical.ts kraschat på enstaka källor
 * pga transienta `fetch failed`-fel mot Voyage. Idempotent — säkert att
 * köra flera gånger.
 *
 * Kör:
 *   npx tsx scripts/retry-missing-v2.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reconstructSource, splitHierarchical } from './_lib/hierarchical-chunker';
import { extractMetadata } from '../netlify/functions/_shared/extractMetadata';
import { embeddingInput } from '../netlify/functions/_shared/contextPrefix';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY!;
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function embedBatch(texts: string[]): Promise<number[][]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(VOYAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
        body: JSON.stringify({ model: 'voyage-3', input: texts, input_type: 'document' }),
      });
      if (res.ok) {
        const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
        return data.data.map((d) => d.embedding);
      }
      const wait = Math.min(60_000, 2 ** attempt * 5_000);
      console.warn(`  Voyage ${res.status} — väntar ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    } catch (e) {
      const wait = Math.min(60_000, 2 ** attempt * 5_000);
      console.warn(`  ${(e as Error).message} — väntar ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error('Voyage: gav upp efter 6 retries');
}

async function dbWithRetry<T>(
  label: string,
  fn: () => Promise<{ error: { message: string } | null; data?: T | null }>,
): Promise<T | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { error, data } = await fn();
      if (!error) return (data ?? null) as T | null;
      throw new Error(error.message);
    } catch (e) {
      const wait = Math.min(60_000, 2 ** attempt * 3_000);
      console.warn(`  ${label} ${(e as Error).message} — väntar ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`${label}: gav upp efter 6 retries`);
}

async function processSource(filename: string) {
  const v1 = await supabase
    .from('kb_chunks')
    .select('chunk_index, text, source_category, quality_score')
    .eq('filename', filename)
    .order('chunk_index', { ascending: true });
  if (v1.error || !v1.data || v1.data.length === 0) {
    console.log(`  ${filename}: ingen v1-data, hoppar`);
    return;
  }

  const original = reconstructSource((v1.data as Array<{ text: string }>).map((r) => r.text));
  const hier = splitHierarchical(original);
  if (hier.length === 0) return;

  // Rensa eventuella halvfärdiga rader för denna källa
  await supabase.from('kb_chunks_v2').delete().eq('filename', filename);

  const sourceCategory = (v1.data[0] as { source_category?: string | null }).source_category ?? null;
  const qualityScore = (v1.data[0] as { quality_score?: number | null }).quality_score ?? null;

  // Large — mindre batchstorlek för stora källor (Voyage payload-limit-säkring)
  const LARGE_BATCH = 10;
  const largeInputs = hier.map((h) => embeddingInput(filename, h.index, h.text));
  const largeEmbs: number[][] = [];
  for (let i = 0; i < largeInputs.length; i += LARGE_BATCH) {
    const batch = largeInputs.slice(i, i + LARGE_BATCH);
    largeEmbs.push(...(await embedBatch(batch)));
    process.stdout.write(`    L ${i + batch.length}/${largeInputs.length}\r`);
  }
  const largeRows = hier.map((h, i) => {
    const meta = extractMetadata(h.text);
    return {
      filename,
      chunk_index: h.index,
      parent_id: null as string | null,
      chunk_level: 'large' as const,
      text: h.text,
      token_count: Math.round(h.text.length / 4),
      embedding: largeEmbs[i],
      source_category: sourceCategory,
      quality_score: qualityScore,
      law_ref: meta.law_ref,
      paragraph_ref: meta.paragraph_ref,
      section: meta.section,
    };
  });
  const insData = await dbWithRetry<Array<{ id: string; chunk_index: number }>>(
    'insert large',
    async () => {
      const r = await supabase.from('kb_chunks_v2').insert(largeRows).select('id, chunk_index');
      return { error: r.error, data: (r.data ?? null) as unknown as Array<{ id: string; chunk_index: number }> | null };
    },
  );
  const parentIdByIdx = new Map<number, string>();
  for (const row of insData ?? []) {
    parentIdByIdx.set(row.chunk_index, row.id);
  }

  // Small
  const SMALL_BATCH = 25;
  const smalls = hier.flatMap((h) => h.smalls);
  const smallInputs = smalls.map((s, i) => embeddingInput(filename, i, s.text));
  const smallEmbs: number[][] = [];
  for (let i = 0; i < smallInputs.length; i += SMALL_BATCH) {
    const batch = smallInputs.slice(i, i + SMALL_BATCH);
    smallEmbs.push(...(await embedBatch(batch)));
    process.stdout.write(`    S ${i + batch.length}/${smallInputs.length}\r`);
  }
  const smallRows = smalls.map((s, i) => {
    const meta = extractMetadata(s.text);
    return {
      filename,
      chunk_index: i,
      parent_id: parentIdByIdx.get(s.parentIndex) ?? null,
      chunk_level: 'small' as const,
      text: s.text,
      token_count: Math.round(s.text.length / 4),
      embedding: smallEmbs[i],
      source_category: sourceCategory,
      quality_score: qualityScore,
      law_ref: meta.law_ref,
      paragraph_ref: meta.paragraph_ref,
      section: meta.section,
    };
  });
  // Splitta small-insert i mindre batchar — undvik stora payloads vid nätstrul
  const SMALL_INSERT_BATCH = 100;
  for (let i = 0; i < smallRows.length; i += SMALL_INSERT_BATCH) {
    const slice = smallRows.slice(i, i + SMALL_INSERT_BATCH);
    await dbWithRetry('insert small', async () => {
      const r = await supabase.from('kb_chunks_v2').insert(slice);
      return { error: r.error };
    });
  }
  console.log(`  ${filename}: ${largeRows.length}L + ${smallRows.length}S`);
}

async function main() {
  console.log('Hittar källor som saknas eller är ofullständiga i v2...');
  // En källa anses ofullständig om den har 0 small chunks (ingen retrieval möjlig).
  const v1 = await supabase.from('kb_chunks').select('filename').limit(10000);
  const v1Files = new Set((v1.data ?? []).map((r) => (r as { filename: string }).filename));

  const incomplete: string[] = [];
  for (const f of v1Files) {
    const { count } = await supabase
      .from('kb_chunks_v2')
      .select('id', { count: 'exact', head: true })
      .eq('filename', f)
      .eq('chunk_level', 'small');
    if ((count ?? 0) === 0) incomplete.push(f);
  }
  console.log(`Ofullständiga i v2: ${incomplete.length} källor`);

  for (const f of incomplete) {
    try {
      await processSource(f);
    } catch (e) {
      console.error(`  FEL ${f}: ${(e as Error).message}`);
    }
  }
  console.log('Klar.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
