import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

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

interface Verdict {
  contradiction: boolean;
  severity: number;
  reasoning: string;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const SIMILARITY_LOW = 0.75;
const SIMILARITY_HIGH = 0.95;
const MAX_CANDIDATES_PER_CHUNK = 5;
const MATCH_COUNT = 10;

// Audit fokuserar på primärkällor — lagar och interna dokument.
// Webbsidor (el-kretsen.se) är sekundära och har mycket noise.
const AUDIT_CATEGORIES = ['law', 'internal'];
const MIN_QUALITY = 40;

// Respektera Netlifys 26s-tak — bryt vid 22s så vi hinner skriva state + respons
const TIME_BUDGET_MS = 22_000;
// Anthropic-anrop kan parallelliseras. 8 samtidiga gånger 1-2s = 2s per grupp.
const CLAUDE_CONCURRENCY = 8;

const CONTRADICTION_PROMPT = `Du analyserar två textstycken från El-Kretsens kunskapsbas (EU Battery Regulation, WEEE-direktivet, svensk miljölagstiftning, producentansvar, förpackningsavgifter). Avgör om de säger emot varandra på ett sätt som skulle ge motstridiga svar till användare. Fokusera på faktiska motsägelser: olika datum, belopp, tröskelvärden, ansvarsfördelning, procedurer. Ignorera stilistiska skillnader och olika detaljnivå. Svara ENDAST med giltig JSON: {"contradiction": boolean, "severity": 1-5, "reasoning": "svensk text, max 2 meningar"}. Severity 5 = direkta lagkrav som motsäger varandra. Severity 1 = marginella formuleringsskillnader.`;

export default async (req: Request) => {
  const startedAt = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  // Cron-secret: skyddar mot att externa klienter triggar audit
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers.get('x-cron-secret');
  if (!cronSecret) {
    return json({ error: 'CRON_SECRET not configured on server' }, 500);
  }
  if (providedSecret !== cronSecret) {
    return json({ error: 'Forbidden' }, 403);
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
  const offset = Math.max(0, body.offset ?? 0);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Hämta total count — bara chunks som kvalificerar för audit
  const { count: totalChunks } = await supabase
    .from('kb_chunks')
    .select('id', { count: 'exact', head: true })
    .in('source_category', AUDIT_CATEGORIES)
    .gte('quality_score', MIN_QUALITY);

  if (totalChunks == null) {
    return json({ error: 'Failed to count kb_chunks' }, 502);
  }

  // Hämta en batch chunks ordnade på id — endast primärkällor med bra kvalitet
  const { data: chunks, error: chunksError } = await supabase
    .from('kb_chunks')
    .select('id, filename, chunk_index, text, embedding, source_category')
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
          .from('kb_chunks')
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

        // Normalisera ordning (chunk med lägre uuid först) för att matcha unique idx
        const [chunkA, chunkB] = chunk.id < other.id ? [chunk, other] : [other, chunk];

        // Om paret är internal↔law = drift (intern dokumentation har glidit
        // från aktuell lagtext) snarare än en contradiction mellan två lagar.
        const otherCategory = metaMap.get(other.id)?.source_category;
        const cats = [chunk.source_category, otherCategory].sort().join(':');
        const issueType = cats === 'internal:law' ? 'drift' : 'contradiction';

        const { error: insertError } = await supabase.from('kb_review_queue').insert(
          {
            chunk_a_id: chunkA.id,
            chunk_b_id: chunkB.id,
            issue_type: issueType,
            severity: Math.max(1, Math.min(5, Math.round(verdict.severity))),
            similarity: other.similarity.toFixed(3),
            ai_reasoning: verdict.reasoning,
            status: 'pending',
          },
          { count: undefined },
        );
        // Unique-constraint-violation (23505) betyder att paret redan finns — OK.
        if (!insertError) contradictionsFound++;
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

async function analyseContradiction(
  a: ChunkRow,
  b: MatchedChunk,
  anthropicKey: string,
): Promise<Verdict | null> {
  const userContent = `Stycke A (${a.filename}, stycke ${a.chunk_index + 1}):
"""
${a.text}
"""

Stycke B (${b.filename}, stycke ${b.chunk_index + 1}):
"""
${b.text}
"""

Semantisk likhet: ${b.similarity.toFixed(3)}

Returnera JSON enligt instruktion.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 300,
        temperature: 0,
        system: CONTRADICTION_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonText = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonText) as Verdict;
    if (typeof parsed.contradiction !== 'boolean') return null;
    if (typeof parsed.severity !== 'number') parsed.severity = 1;
    if (typeof parsed.reasoning !== 'string') parsed.reasoning = '';
    return parsed;
  } catch {
    return null;
  }
}

function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      return null;
    }
  }
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-cron-secret',
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
