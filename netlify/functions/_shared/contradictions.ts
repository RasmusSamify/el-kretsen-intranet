import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Delad motsägelse-logik. Används av två vägar:
 *  - kb-audit-contradictions: nattligt svep över HELA basen (offset-batchat).
 *  - checkSourceForContradictions: riktad koll på EN nyss uppladdad/ändrad källa
 *    direkt vid ingest, så att nya konflikter syns inom minuter istället för att
 *    behöva vänta tills nattsvepet råkar nå styckena (kan ta veckor).
 *
 * Prompt + analys + insert bor här så att båda vägarna är garanterat identiska.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export const CONTRA_MODEL = 'claude-sonnet-4-6';

export const SIMILARITY_LOW = 0.75;
export const SIMILARITY_HIGH = 0.95;
export const MAX_CANDIDATES_PER_CHUNK = 5;
export const MATCH_COUNT = 10;

// Audit fokuserar på primärkällor — lagar och interna dokument.
// Webbsidor (el-kretsen.se) är sekundära och har mycket noise.
export const AUDIT_CATEGORIES = ['law', 'internal'];
export const MIN_QUALITY = 40;

export const CONTRADICTION_PROMPT = `Du analyserar två textstycken från El-Kretsens kunskapsbas (EU Battery Regulation, WEEE-direktivet, svensk miljölagstiftning, producentansvar, förpackningsavgifter). Avgör om de säger emot varandra på ett sätt som skulle ge motstridiga svar till användare. Fokusera på faktiska motsägelser: olika datum, belopp, tröskelvärden, ansvarsfördelning, procedurer. Ignorera stilistiska skillnader och olika detaljnivå. Svara ENDAST med giltig JSON: {"contradiction": boolean, "severity": 1-5, "reasoning": "svensk text, max 2 meningar"}. Severity 5 = direkta lagkrav som motsäger varandra. Severity 1 = marginella formuleringsskillnader.`;

export interface ContraChunk {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
}

export interface NeighborChunk extends ContraChunk {
  similarity: number;
}

export interface Verdict {
  contradiction: boolean;
  severity: number;
  reasoning: string;
}

export function parseEmbedding(raw: unknown): number[] | null {
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

export async function analyseContradiction(
  a: ContraChunk,
  b: NeighborChunk,
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
        model: CONTRA_MODEL,
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

/**
 * Lägger in ett motsägelsepar i kb_review_queue. Normaliserar ordningen (lägre
 * uuid först) för att matcha unique-index — dubbletter (23505) sväljs tyst.
 * internal↔law klassas som "drift" (intern doc har glidit från lagtext).
 * Returnerar true om en NY rad skapades.
 */
export async function insertReviewPair(
  admin: SupabaseClient,
  a: { id: string; source_category: string },
  b: { id: string; similarity: number; source_category: string },
  verdict: Verdict,
): Promise<boolean> {
  const [idA, idB] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
  const cats = [a.source_category, b.source_category].sort().join(':');
  const issueType = cats === 'internal:law' ? 'drift' : 'contradiction';

  const { error } = await admin.from('kb_review_queue').insert({
    chunk_a_id: idA,
    chunk_b_id: idB,
    issue_type: issueType,
    severity: Math.max(1, Math.min(5, Math.round(verdict.severity))),
    similarity: b.similarity.toFixed(3),
    ai_reasoning: verdict.reasoning,
    status: 'pending',
  });
  // Unique-constraint-violation (23505) = paret finns redan → ingen ny rad.
  return !error;
}

interface AnchorRow extends ContraChunk {
  embedding: number[] | string;
  source_category: string;
}

export interface SourceCheckResult {
  pairsChecked: number;
  contradictionsFound: number;
  skipped: boolean;
}

/**
 * Riktad motsägelsekoll på en enskild källa direkt vid uppladdning.
 * Hämtar källans large-chunks (bara om de är audit-bara: law/internal +
 * tillräcklig kvalitet), söker grannar i hela basen och kör samma analys som
 * nattauditen. Best-effort: tidsbudget + svalda fel så ingest aldrig bryts.
 */
export async function checkSourceForContradictions(
  admin: SupabaseClient,
  anthropicKey: string,
  filename: string,
  opts: { timeBudgetMs?: number; concurrency?: number } = {},
): Promise<SourceCheckResult> {
  const startedAt = Date.now();
  const timeBudget = opts.timeBudgetMs ?? 18_000;
  const concurrency = opts.concurrency ?? 8;

  const { data: anchorsRaw } = await admin
    .from('kb_chunks_v2')
    .select('id, filename, chunk_index, text, embedding, source_category, quality_score')
    .eq('filename', filename)
    .eq('chunk_level', 'large')
    .in('source_category', AUDIT_CATEGORIES)
    .gte('quality_score', MIN_QUALITY);

  const anchors = (anchorsRaw ?? []) as Array<AnchorRow & { quality_score: number }>;
  if (anchors.length === 0) {
    // Website/lågkvalitet eller saknad källa → matchar inte auditens scope. Hoppa.
    return { pairsChecked: 0, contradictionsFound: 0, skipped: true };
  }

  let pairsChecked = 0;
  let contradictionsFound = 0;
  const seenPairKeys = new Set<string>();

  outer: for (const anchor of anchors) {
    if (Date.now() - startedAt > timeBudget) break;

    const embedding = parseEmbedding(anchor.embedding);
    if (!embedding) continue;

    const { data: matches, error: matchError } = await admin.rpc('match_kb_chunks', {
      query_embedding: embedding,
      match_threshold: SIMILARITY_LOW,
      match_count: MATCH_COUNT,
    });
    if (matchError) continue;

    const rawCandidates = ((matches ?? []) as NeighborChunk[]).filter(
      (m) =>
        m.id !== anchor.id &&
        m.filename !== anchor.filename &&
        m.similarity >= SIMILARITY_LOW &&
        m.similarity <= SIMILARITY_HIGH,
    );

    const candidateIds = rawCandidates.map((c) => c.id);
    const { data: meta } =
      candidateIds.length > 0
        ? await admin
            .from('kb_chunks_v2')
            .select('id, source_category, quality_score')
            .in('id', candidateIds)
        : { data: [] };
    const metaMap = new Map(
      (meta ?? []).map((m) => [
        (m as { id: string }).id,
        m as { id: string; source_category: string; quality_score: number },
      ]),
    );

    const candidates = rawCandidates
      .filter((c) => {
        const m = metaMap.get(c.id);
        if (!m) return false;
        return AUDIT_CATEGORIES.includes(m.source_category) && m.quality_score >= MIN_QUALITY;
      })
      .slice(0, MAX_CANDIDATES_PER_CHUNK);

    const pairsToCheck = candidates.filter((other) => {
      const [x, y] = [anchor.id, other.id].sort();
      const key = `${x}::${y}`;
      if (seenPairKeys.has(key)) return false;
      seenPairKeys.add(key);
      return true;
    });

    for (let i = 0; i < pairsToCheck.length; i += concurrency) {
      if (Date.now() - startedAt > timeBudget) break outer;

      const slice = pairsToCheck.slice(i, i + concurrency);
      const verdicts = await Promise.all(
        slice.map((other) => analyseContradiction(anchor, other, anthropicKey)),
      );

      for (let j = 0; j < slice.length; j++) {
        pairsChecked++;
        const other = slice[j];
        const verdict = verdicts[j];
        if (!verdict || !verdict.contradiction) continue;
        const otherCategory = metaMap.get(other.id)?.source_category ?? 'internal';
        const inserted = await insertReviewPair(
          admin,
          { id: anchor.id, source_category: anchor.source_category },
          { id: other.id, similarity: other.similarity, source_category: otherCategory },
          verdict,
        );
        if (inserted) contradictionsFound++;
      }
    }
  }

  return { pairsChecked, contradictionsFound, skipped: false };
}
