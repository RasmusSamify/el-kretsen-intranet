/**
 * End-to-end RAG smoke test.
 * Tar en fråga, embeddar via Voyage, söker via pgvector, skriver ut top-matches.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  /* ignore */
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://jnwatbnkdzuyhqmcerej.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY!;

const questions = [
  'Vad är producentansvar för batterier?',
  'När tas B77 bort?',
  'Förklara skillnaden mellan bärbara och industri-batterier',
  'Vem vann VM i fotboll 1994?', // utanför domän
];

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_KEY}`,
    },
    body: JSON.stringify({ model: 'voyage-3', input: [text], input_type: 'query' }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const q of questions) {
    console.log(`\n━━━ Q: ${q} ━━━`);
    const embedding = await embed(q);
    const { data, error } = await supabase.rpc('match_kb_chunks', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 3,
    });
    if (error) {
      console.error('  Fel:', error.message);
      continue;
    }
    if (!data || data.length === 0) {
      console.log('  INGEN TRÄFF (utanför domän → AI kommer svara "Jag hittar inte svaret i kunskapsbanken")');
      continue;
    }
    for (const row of data as Array<{ filename: string; chunk_index: number; similarity: number; text: string }>) {
      const excerpt = row.text.slice(0, 120).replace(/\s+/g, ' ');
      console.log(`  [${(row.similarity * 100).toFixed(1)}%] ${row.filename} · stycke ${row.chunk_index + 1}`);
      console.log(`         "${excerpt}…"`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
