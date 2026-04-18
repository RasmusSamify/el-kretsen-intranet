/**
 * Backfill embeddings for all TXT files in the "Linneas AI-losning" Supabase bucket.
 *
 * Usage:
 *   Create .env.local with OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY, then:
 *   npm run backfill
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local manually (tsx doesn't auto-load)
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

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://jnwatbnkdzuyhqmcerej.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const BUCKET = 'Linneas AI-losning';
const EMBEDDING_MODEL = 'voyage-3';
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 25;
// Voyage free tier: 3 RPM / 10K TPM (rolling 60s window).
// Vänta 62 sek så varje batch faller utanför fönstret innan nästa skickas.
const DELAY_BETWEEN_BATCHES_MS = 62000;

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY saknas. Sätt den i .env.local.');
  process.exit(1);
}
if (!VOYAGE_API_KEY) {
  console.error('VOYAGE_API_KEY saknas. Sätt den i .env.local.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function chunkText(text: string, filename: string): Array<{ filename: string; chunk_index: number; text: string }> {
  const chunks: Array<{ filename: string; chunk_index: number; text: string }> = [];
  const paragraphs = text.split(/\n\s*\n/);

  let buffer = '';
  let index = 0;
  for (const paragraph of paragraphs) {
    if (buffer.length + paragraph.length + 2 <= CHUNK_SIZE) {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    } else {
      if (buffer) {
        chunks.push({ filename, chunk_index: index++, text: buffer });
        const tail = buffer.slice(Math.max(0, buffer.length - CHUNK_OVERLAP));
        buffer = `${tail}\n\n${paragraph}`;
      } else {
        // Paragraph too big on its own — hard-split
        for (let i = 0; i < paragraph.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          const end = Math.min(i + CHUNK_SIZE, paragraph.length);
          chunks.push({ filename, chunk_index: index++, text: paragraph.slice(i, end) });
          if (end === paragraph.length) break;
        }
        buffer = '';
      }
    }
  }
  if (buffer) chunks.push({ filename, chunk_index: index++, text: buffer });
  return chunks;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      input_type: 'document',
    }),
  });
  if (!response.ok) {
    throw new Error(`Voyage ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
  return data.data.map((d) => d.embedding);
}

async function main() {
  console.log(`\nBackfill embeddings startar mot bucket "${BUCKET}"…\n`);

  const { data: files, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  if (error) {
    console.error('Kunde inte lista filer:', error.message);
    process.exit(1);
  }

  const txtFiles = (files ?? []).filter(
    (f) => f.name.toLowerCase().endsWith('.txt') && f.name !== '.emptyFolderPlaceholder',
  );

  console.log(`Hittade ${txtFiles.length} TXT-fil(er) att processa.\n`);

  if (txtFiles.length === 0) {
    console.log('Inga filer att embedda. Klart.');
    return;
  }

  // Step 1: Skip already-embedded chunks (resumable mode)
  const { data: existing } = await supabase
    .from('kb_chunks')
    .select('filename, chunk_index')
    .not('embedding', 'is', null);
  const doneSet = new Set((existing ?? []).map((r) => `${r.filename}::${r.chunk_index}`));
  console.log(`${doneSet.size} chunks redan embeddade — hoppar över dessa.\n`);

  // Step 2: Chunk all files (download via service role, private bucket)
  const allChunks: Array<{ filename: string; chunk_index: number; text: string }> = [];
  for (const file of txtFiles) {
    try {
      const { data, error: dlError } = await supabase.storage.from(BUCKET).download(file.name);
      if (dlError || !data) {
        console.warn(`  ! Kunde inte hämta ${file.name}: ${dlError?.message ?? 'ingen data'}`);
        continue;
      }
      const text = await data.text();
      const fileChunks = chunkText(text, file.name);
      allChunks.push(...fileChunks);
      console.log(`  · ${file.name} → ${fileChunks.length} chunks (${text.length} tecken)`);
    } catch (e) {
      console.warn(`  ! Fel för ${file.name}: ${(e as Error).message}`);
    }
  }

  const pendingChunks = allChunks.filter((c) => !doneSet.has(`${c.filename}::${c.chunk_index}`));
  console.log(`\nTotalt ${allChunks.length} chunks (${pendingChunks.length} saknar embedding).\n`);
  if (pendingChunks.length === 0) {
    console.log('Allt är redan embeddad. Klar.\n');
    return;
  }

  // Step 3: Embed in batches with rate limiting
  let inserted = 0;
  const totalBatches = Math.ceil(pendingChunks.length / BATCH_SIZE);
  for (let i = 0; i < pendingChunks.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = pendingChunks.slice(i, i + BATCH_SIZE);

    const startedAt = Date.now();
    const embeddings = await embedBatch(batch.map((c) => c.text));
    const elapsed = Date.now() - startedAt;

    const rows = batch.map((c, idx) => ({
      filename: c.filename,
      chunk_index: c.chunk_index,
      text: c.text,
      token_count: Math.round(c.text.length / 4),
      embedding: embeddings[idx],
    }));

    const { error: insertError } = await supabase.from('kb_chunks').upsert(rows, {
      onConflict: 'filename,chunk_index',
    });
    if (insertError) {
      console.error(`\nInfogning misslyckades för batch ${batchNum}:`, insertError.message);
      process.exit(1);
    }

    inserted += rows.length;
    process.stdout.write(`\r  Embeddings: ${inserted}/${pendingChunks.length} (batch ${batchNum}/${totalBatches})   `);

    // Throttle to respect Voyage free tier (3 RPM)
    if (batchNum < totalBatches) {
      const remaining = DELAY_BETWEEN_BATCHES_MS - elapsed;
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    }
  }

  console.log(`\n\nKlart! ${inserted} chunks är nu inbäddade och sökbara.\n`);
}

main().catch((e) => {
  console.error('\nOvantat fel:', e);
  process.exit(1);
});
