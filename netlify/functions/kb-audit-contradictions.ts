import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_shared/auth';
import {
  analyseContradiction,
  AUDIT_CATEGORIES,
  insertReviewPair,
  MATCH_COUNT,
  MAX_CANDIDATES_PER_CHUNK,
  MIN_QUALITY,
  parseEmbedding,
  SIMILARITY_HIGH,
  SIMILARITY_LOW,
} from './_shared/contradictions';

interface AuditRequest {
  batch_size?: number;
  offset?: number;
}

interface AuditResponse {
  pairs_checked: number;
  contradictions_found: number;
  time_elapsed_ms: number;
  batch_offset_next: number;
  completed: boolean;
  chunks_processed: number;
  chunks_total: number;
}

interface ChunkRow {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
  embedding: number[] | string;
  source_category: string;
}

interface MatchedChunk {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
  similarity: number;
}

// Respektera Netlifys 26s-tak — bryt vid 22s så vi hinner skriva state + respons
const TIME_BUDGET_MS = 22_000;
// Anthropic-anrop kan parallelliseras. 8 samtidiga gånger 1-2s = 2s per grupp.
const CLAUDE_CONCURRENCY = 8;

export default async (req: Request) => {
  const startedAt = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  // Auth: cron-secret (schemalagt jobb) ELLER admin-JWT (manuell körning från Systemstatus)
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers.get('x-cron-secret');
  const cronOk = !!cronSecret && providedSecret === cronSecret;
  if (!cronOk) {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anthropicKey || !supabaseUrl || !serviceKey) {
    return json(
      { error: 'Missing ANTHROPIC_API_KEY, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      500,
    );
  }

  let body: AuditRequest = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      body = (await req.json()) as AuditRequest;
    } catch {
      /* empty body OK */
    }
  }
  const batchSize = Math.max(1, Math.min(500, body.batch_size ?? 50));

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Manuell admin-körning skickar ingen offset → fortsätt från sparad position
  let offset: number;
  if (typeof body.offset === 'number') {
    offset = Math.max(0, body.offset);
  } else {
    const { data: st } = await supabase
      .from('kb_audit_state')
      .select('value')
      .eq('key', 'contradiction_offset')
      .maybeSingle();
    offset = Math.max(0, Number((st?.value as { next_offset?: number })?.next_offset ?? 0));
  }

  // Audit jobbar mot kb_chunks_v2 large-nivå — det är där ELvis hämtar
  // kontexten från, så motsägelser hittas på samma textnivå som RAG-svaren.
  const { count: totalChunks } = await supabase
    .from('kb_chunks_v2')
    .select('id', { count: 'exact', head: true })
    .eq('chunk_level', 'large')
    .in('source_category', AUDIT_CATEGORIES)
    .gte('quality_score', MIN_QUALITY);

  if (totalChunks == null) {
    return json({ error: 'Failed to count kb_chunks_v2' }, 502);
  }

  const { data: chunks, error: chunksError } = await supabase
    .from('kb_chunks_v2')
    .select('id, filename, chunk_index, text, embedding, source_category')
    .eq('chunk_level', 'large')
    .in('source_category', AUDIT_CATEGORIES)
    .gte('quality_score', MIN_QUALITY)
    .order('id', { ascending: true })
    .range(offset, offset + batchSize - 1);

  if (chunksError) {
    return json({ error: `Failed to load chunks: ${chunksError.message}` }, 502);
  }

  const batch = (chunks ?? []) as ChunkRow[];
  let pairsChecked = 0;
  let contradictionsFound = 0;
  let chunksProcessed = 0;

  const seenPairKeys = new Set<string>();

  outer: for (const chunk of batch) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    // Embeddings returneras som sträng av Supabase — parse:a
    const embedding = parseEmbedding(chunk.embedding);
    if (!embedding) {
      chunksProcessed++;
      continue;
    }

    const { data: matches, error: matchError } = await supabase.rpc('match_kb_chunks', {
      query_embedding: embedding,
      match_threshold: SIMILARITY_LOW,
      match_count: MATCH_COUNT,
    });

    if (matchError) {
      // Svälj felet men fortsätt med nästa chunk
      chunksProcessed++;
      continue;
    }

    // Filtrera bort kandidater från website-kategorin och lågkvalitet
    // Vi gör detta genom att fråga för varje match-id — men för prestanda
    // accepterar vi att match_kb_chunks returnerar även website-chunks och
    // filtrerar bort dem här via ett separat lookup.
    // Same-filename pairs produce massive noise from chunk overlap — ett
    // enskilt dokument är per definition internt konsistent. Riktiga
    // contradictions lever mellan DOKUMENT (lag vs. intern instruktion etc).
    const rawCandidates = (matches ?? [])
      .filter((m: MatchedChunk) =>
        m.id !== chunk.id &&
        m.filename !== chunk.filename &&
        m.similarity >= SIMILARITY_LOW &&
        m.similarity <= SIMILARITY_HIGH,
      ) as MatchedChunk[];

    // Hämta source_category + quality för kandidaterna
    const candidateIds = rawCandidates.map((c) => c.id);
    const { data: meta } = candidateIds.length > 0
      ? await supabase
          .from('kb_chunks_v2')
          .select('id, source_category, quality_score')
          .in('id', candidateIds)
      : { data: [] };
    const metaMap = new Map((meta ?? []).map((m) => [m.id, m]));

    const candidates = rawCandidates
      .filter((c) => {
        const m = metaMap.get(c.id);
        if (!m) return false;
        return AUDIT_CATEGORIES.includes(m.source_category) && m.quality_score >= MIN_QUALITY;
      })
      .slice(0, MAX_CANDIDATES_PER_CHUNK);

    // Dedupera par inom batchen (chunk a<->b ska bara testas en gång)
    const pairsToCheck: Array<{
      other: MatchedChunk;
      pairKey: string;
    }> = [];
    for (const other of candidates) {
      const [idA, idB] = [chunk.id, other.id].sort();
      const pairKey = `${idA}::${idB}`;
      if (seenPairKeys.has(pairKey)) continue;
      seenPairKeys.add(pairKey);
      pairsToCheck.push({ other, pairKey });
    }

    // Parallellisera Claude-anropen i grupper om CLAUDE_CONCURRENCY
    for (let i = 0; i < pairsToCheck.length; i += CLAUDE_CONCURRENCY) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break outer;

      const slice = pairsToCheck.slice(i, i + CLAUDE_CONCURRENCY);
      const verdicts = await Promise.all(
        slice.map(({ other }) => analyseContradiction(chunk, other, anthropicKey)),
      );

      for (let j = 0; j < slice.length; j++) {
        pairsChecked++;
        const { other } = slice[j];
        const verdict = verdicts[j];
        if (!verdict || !verdict.contradiction) continue;

        const otherCategory = metaMap.get(other.id)?.source_category ?? 'internal';
        const inserted = await insertReviewPair(
          supabase,
          { id: chunk.id, source_category: chunk.source_category },
          { id: other.id, similarity: other.similarity, source_category: otherCategory },
          verdict,
        );
        if (inserted) contradictionsFound++;
      }
    }

    chunksProcessed++;
  }

  const nextOffset = offset + chunksProcessed;
  const completed = nextOffset >= (totalChunks ?? 0);

  // Skriv state så nästa cron-körning fortsätter där vi slutade (eller börjar om)
  await supabase.from('kb_audit_state').upsert(
    {
      key: 'contradiction_offset',
      value: {
        next_offset: completed ? 0 : nextOffset,
        last_run_at: new Date().toISOString(),
        last_pairs_checked: pairsChecked,
        last_contradictions_found: contradictionsFound,
        last_completed: completed,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );

  const response: AuditResponse = {
    pairs_checked: pairsChecked,
    contradictions_found: contradictionsFound,
    time_elapsed_ms: Date.now() - startedAt,
    batch_offset_next: completed ? 0 : nextOffset,
    completed,
    chunks_processed: chunksProcessed,
    chunks_total: totalChunks ?? 0,
  };

  return json(response, 200);
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export const config: Config = {
  path: '/api/kb-audit-contradictions',
};
