/**
 * Smoke test: jämför retrieval-kvaliteten mellan v1 (match_kb_chunks_hybrid)
 * och v2 (match_kb_chunks_hybrid_v2) på ett par diagnostiska frågor.
 * Kör efter rechunk-hierarchical klar och innan vi swappar ai-search.ts.
 *
 *   npx tsx scripts/smoke-test-v2.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expandQueryWithCodes } from '../netlify/functions/_shared/queryExpansion';

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SB = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const VOYAGE_KEY = process.env.VOYAGE_API_KEY!;

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
    body: JSON.stringify({ model: 'voyage-3', input: [text], input_type: 'query' }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

const QUESTIONS = [
  'Vad är B74?',
  'Vilken kod gäller mobiltelefoner?',
  'När tas B77 bort?',
  'Vad säger SFS 2022:1276 om producentregistrering?',
  'Vilka batterier räknas som industri-batterier?',
  'Hur deklarerar man en kyl?',
];

interface Match {
  filename: string;
  chunk_index: number;
  text: string;
  similarity: number;
}

async function search(q: string, rpc: string) {
  const expanded = expandQueryWithCodes(q);
  const e = await embed(expanded);
  const { data, error } = await SB.rpc(rpc, {
    query_text: q,
    query_embedding: e,
    match_count: 5,
  });
  if (error) throw new Error(`${rpc}: ${error.message}`);
  return (data ?? []) as Match[];
}

async function main() {
  for (const q of QUESTIONS) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Q: ${q}`);
    const [v1, v2] = await Promise.all([
      search(q, 'match_kb_chunks_hybrid'),
      search(q, 'match_kb_chunks_hybrid_v2'),
    ]);
    console.log('\n  v1 (1200-tecken chunks):');
    for (const m of v1.slice(0, 3)) {
      console.log(`    ${m.filename.slice(0, 60).padEnd(60)} #${m.chunk_index}  sim=${m.similarity.toFixed(3)}  len=${m.text.length}`);
    }
    console.log('\n  v2 (hierarkiska, parent large skickas till Claude):');
    for (const m of v2.slice(0, 3)) {
      console.log(`    ${m.filename.slice(0, 60).padEnd(60)} #${m.chunk_index}  sim=${m.similarity.toFixed(3)}  len=${m.text.length}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
