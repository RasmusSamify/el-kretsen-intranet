/**
 * Targeted retry: kör processSource direkt på en hårdkodad lista. Används när
 * generell missing-detection misslyckats (t.ex. PostgREST default row cap).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reconstructSource, splitHierarchical } from './_lib/hierarchical-chunker';
import { extractMetadata } from '../netlify/functions/_shared/extractMetadata';
import { embeddingInput } from '../netlify/functions/_shared/contextPrefix';

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const VOYAGE_KEY = process.env.VOYAGE_API_KEY!;

const TARGETS = [
  'www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/miljobalk-1998808_sfs-1998-808/',
  'www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/miljotillsynsforordning-201113_sfs-2011-13/',
  'www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-20221276-om-producentansvar-for_sfs-2022-1276/',
  'www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-2025813-med-kompletterande_sfs-2025-813/',
];

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const wait = Math.min(60_000, 2 ** attempt * 3_000);
      console.warn(`  ${label} ${(e as Error).message} — väntar ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`${label}: gav upp efter 6 retries`);
}

async function embed(texts: string[]): Promise<number[][]> {
  return withRetry('voyage', async () => {
    const r = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
      body: JSON.stringify({ model: 'voyage-3', input: texts, input_type: 'document' }),
    });
    if (!r.ok) throw new Error(`voyage ${r.status}`);
    const d = (await r.json()) as { data: Array<{ embedding: number[] }> };
    return d.data.map((x) => x.embedding);
  });
}

async function processOne(filename: string) {
  console.log(`\n${filename}`);
  // Fetch all v1 chunks for this filename via paginated range
  const v1: Array<{ chunk_index: number; text: string; source_category: string | null; quality_score: number | null }> = [];
  let from = 0;
  for (;;) {
    const r = await supabase
      .from('kb_chunks')
      .select('chunk_index, text, source_category, quality_score')
      .eq('filename', filename)
      .order('chunk_index', { ascending: true })
      .range(from, from + 499);
    if (r.error || !r.data || r.data.length === 0) break;
    v1.push(...(r.data as typeof v1));
    if (r.data.length < 500) break;
    from += 500;
  }
  console.log(`  v1 chunks: ${v1.length}`);
  if (v1.length === 0) return;

  const original = reconstructSource(v1.map((r) => r.text));
  const hier = splitHierarchical(original);
  console.log(`  ${hier.length}L planned`);

  // Wipe existing rows
  await withRetry('delete', async () => {
    const r = await supabase.from('kb_chunks_v2').delete().eq('filename', filename);
    if (r.error) throw new Error(r.error.message);
    return null;
  });

  const sourceCategory = v1[0].source_category;
  const qualityScore = v1[0].quality_score;

  // Embed large in batches of 10
  const largeInputs = hier.map((h) => embeddingInput(filename, h.index, h.text));
  const largeEmbs: number[][] = [];
  for (let i = 0; i < largeInputs.length; i += 10) {
    const batch = largeInputs.slice(i, i + 10);
    largeEmbs.push(...(await embed(batch)));
    process.stdout.write(`    L ${i + batch.length}/${largeInputs.length}\n`);
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

  // Insert large in batches of 25 with retry
  const parentIdByIdx = new Map<number, string>();
  for (let i = 0; i < largeRows.length; i += 25) {
    const slice = largeRows.slice(i, i + 25);
    const inserted = await withRetry('insert large', async () => {
      const r = await supabase.from('kb_chunks_v2').insert(slice).select('id, chunk_index');
      if (r.error) throw new Error(r.error.message);
      return r.data as Array<{ id: string; chunk_index: number }>;
    });
    for (const row of inserted) parentIdByIdx.set(row.chunk_index, row.id);
  }

  // Embed + insert small
  const smalls = hier.flatMap((h) => h.smalls);
  const smallInputs = smalls.map((s, i) => embeddingInput(filename, i, s.text));
  const smallEmbs: number[][] = [];
  for (let i = 0; i < smallInputs.length; i += 25) {
    const batch = smallInputs.slice(i, i + 25);
    smallEmbs.push(...(await embed(batch)));
    process.stdout.write(`    S ${i + batch.length}/${smallInputs.length}\n`);
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

  for (let i = 0; i < smallRows.length; i += 100) {
    const slice = smallRows.slice(i, i + 100);
    await withRetry('insert small', async () => {
      const r = await supabase.from('kb_chunks_v2').insert(slice);
      if (r.error) throw new Error(r.error.message);
      return null;
    });
  }
  console.log(`  KLAR: ${largeRows.length}L + ${smallRows.length}S`);
}

async function main() {
  for (const f of TARGETS) {
    try {
      await processOne(f);
    } catch (e) {
      console.error(`  FATAL ${f}: ${(e as Error).message}`);
    }
  }
  console.log('\nAlla targets bearbetade.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
