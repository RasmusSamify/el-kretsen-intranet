/**
 * Backfill `law_ref`, `paragraph_ref` och `section` på existerande chunks i
 * `kb_chunks`. Engångsoperation i samband med v1.5.0 (metadata-kolumner).
 *
 * Använder samma regex som ingest-pipelines (`_shared/extractMetadata.ts`) så
 * gamla och nya chunks blir konsekvent extraherade.
 *
 * Kör:
 *   npx tsx scripts/backfill-metadata.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractMetadata } from '../netlify/functions/_shared/extractMetadata';

const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  console.warn('Ingen .env.local hittades — antar att variabler är satta i env.');
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://jnwatbnkdzuyhqmcerej.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE_SIZE = 500;
const UPDATE_BATCH = 50;

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY saknas. Sätt den i .env.local.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface ChunkRow {
  id: string;
  text: string;
}

async function fetchAll(): Promise<ChunkRow[]> {
  const all: ChunkRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('kb_chunks')
      .select('id, text')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`fetch chunks: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as ChunkRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function main() {
  console.log('Hämtar alla chunks...');
  const chunks = await fetchAll();
  console.log(`Hittade ${chunks.length} chunks.`);

  const updates = chunks
    .map((c) => ({ id: c.id, ...extractMetadata(c.text) }))
    .filter((u) => u.law_ref || u.paragraph_ref || u.section);

  console.log(`${updates.length} chunks fick metadata-träff (${chunks.length - updates.length} hade ingen referens i texten).`);

  let written = 0;
  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    const slice = updates.slice(i, i + UPDATE_BATCH);
    await Promise.all(
      slice.map((u) =>
        supabase
          .from('kb_chunks')
          .update({ law_ref: u.law_ref, paragraph_ref: u.paragraph_ref, section: u.section })
          .eq('id', u.id),
      ),
    );
    written += slice.length;
    process.stdout.write(`\rUppdaterat ${written} / ${updates.length}`);
  }
  process.stdout.write('\n');

  // Sanity-stats
  const { data: stats } = await supabase
    .from('kb_chunks')
    .select('law_ref, paragraph_ref', { count: 'exact', head: false })
    .or('law_ref.not.is.null,paragraph_ref.not.is.null');
  console.log(`Totalt chunks med någon metadata: ${stats?.length ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
