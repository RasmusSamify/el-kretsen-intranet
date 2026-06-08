import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_shared/auth';
import { IngestError, replaceSourceInV2 } from './_shared/ingestV2';
import { checkSourceForContradictions } from './_shared/contradictions';

/**
 * Kunskapslucke-stängaren. Tre actions (alla admin):
 *  - draft:   generera ett KB-utkast för en obesvarad fråga, GRUNDAT i befintlig KB.
 *             Hittar aldrig på fakta — saknade fakta blir [ATT KOMPLETTERA: ...]-platshållare.
 *  - commit:  ingesta det (admin-verifierade) innehållet som intern källa + markera luckan stängd.
 *  - dismiss: markera luckan som avfärdad utan åtgärd.
 */

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const EMBEDDING_MODEL = 'voyage-3';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MATCH_COUNT = 10;

const DRAFT_SYSTEM = `Du hjälper El-kretsen att fylla kunskapsluckor i en intern kunskapsbas om producentansvar, batterier, WEEE, avgifter och compliance. Du får en FRÅGA som AI-assistenten inte kunde besvara, samt KONTEXT som redan finns i kunskapsbasen.

ABSOLUTA REGLER:
1. Hitta ALDRIG på fakta, siffror, datum, paragrafer eller priser. Använd endast innehåll i <kontext>.
2. Där ett korrekt svar kräver fakta som INTE finns i <kontext>: skriv en tydlig platshållare i formatet "[ATT KOMPLETTERA: vad som behövs]" och ange i "needs" vilken källa som troligen bör kontrolleras (specifik lag/SFS, EUR-Lex-direktiv, eller intern instruktion).
3. Skriv ett rent, internt kunskapsbas-stycke på svenska som — när platshållarna fyllts — skulle besvara frågan. Börja med en kort rubrik, sedan koncis brödtext.
4. Hellre korta korrekta platshållare än utfyllnad. Detta är ett UTKAST som en människa verifierar mot källa innan publicering.

Svara ENDAST med giltig JSON:
{ "title": "Kort beskrivande titel", "draft": "Hela utkastet som text, inkl. ev. platshållare", "needs": ["Vad som saknas/bör verifieras"], "usedSources": ["filnamn som faktiskt användes"] }`;

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const voyageKey = process.env.VOYAGE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!voyageKey || !anthropicKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured' }, 500);
  }

  let body: {
    action?: string;
    id?: string;
    question?: string;
    gaps_text?: string | null;
    filename?: string;
    content?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- DISMISS (luckan är inte relevant för oss) ----------
  if (body.action === 'dismiss') {
    if (!body.id) return json({ error: 'id krävs' }, 400);
    const { error } = await admin
      .from('ai_unanswered')
      .update({ gap_status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: auth.user.id })
      .eq('id', body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true }, 200);
  }

  // ---------- RESOLVE (luckan är åtgärdad på annat sätt, utan ny källa) ----------
  if (body.action === 'resolve') {
    if (!body.id) return json({ error: 'id krävs' }, 400);
    const { error } = await admin
      .from('ai_unanswered')
      .update({ gap_status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: auth.user.id })
      .eq('id', body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true }, 200);
  }

  // ---------- COMMIT ----------
  if (body.action === 'commit') {
    const id = body.id;
    const filename = (body.filename ?? '').trim();
    const content = body.content ?? '';
    if (!id) return json({ error: 'id krävs' }, 400);
    if (!filename) return json({ error: 'Filnamn krävs' }, 400);
    if (content.trim().length < 50) return json({ error: 'För lite innehåll (minst 50 tecken)' }, 400);

    const normalised = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    try {
      const result = await replaceSourceInV2(admin, voyageKey, normalised, content, {
        sourceCategory: 'internal',
      });
      await admin.from('kb_sources').upsert(
        { filename: normalised, title: normalised.replace(/\.txt$/, ''), source_category: 'internal' },
        { onConflict: 'filename', ignoreDuplicates: false },
      );
      await admin
        .from('ai_unanswered')
        .update({
          gap_status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: auth.user.id,
          resolved_source: normalised,
        })
        .eq('id', id);

      // Direktkoll: säger den nya källan emot något befintligt? Hamnar i Granskning
      // direkt istället för att vänta på nattsvepet. Best-effort — bryt aldrig ingest.
      try {
        await checkSourceForContradictions(admin, anthropicKey, normalised, { timeBudgetMs: 10_000 });
      } catch {
        /* best-effort */
      }

      return json({ ok: true, filename: normalised, chunks: result.largeChunks }, 200);
    } catch (e) {
      if (e instanceof IngestError) return json({ error: e.message }, e.status);
      return json({ error: `Ingest failed: ${(e as Error).message}` }, 502);
    }
  }

  // ---------- DRAFT (default) ----------
  const question = (body.question ?? '').trim();
  if (!question) return json({ error: 'question krävs' }, 400);

  // Embedda frågan och hämta det som redan finns i KB:n (grunden för utkastet)
  let embedding: number[];
  try {
    const res = await fetch(VOYAGE_EMBEDDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${voyageKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: [question], input_type: 'query' }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    embedding = data.data[0].embedding;
  } catch (e) {
    return json({ error: `Embedding failed: ${(e as Error).message}` }, 502);
  }

  const { data: matches } = await admin.rpc('match_kb_chunks_hybrid_v2', {
    query_text: question.slice(0, 2000),
    query_embedding: embedding,
    match_count: MATCH_COUNT,
  });
  const chunks = (matches ?? []) as Array<{ filename: string; chunk_index: number; text: string }>;
  const context =
    chunks.length === 0
      ? '(ingen relevant information finns i kunskapsbasen — utkastet måste i princip helt kompletteras manuellt)'
      : chunks
          .map((c) => `[källa: ${c.filename}, stycke ${c.chunk_index + 1}]\n${c.text}`)
          .join('\n\n---\n\n');

  const userMessage =
    `<fråga>\n${question}\n</fråga>\n` +
    (body.gaps_text ? `\n<kända_luckor>\n${body.gaps_text}\n</kända_luckor>\n` : '') +
    `\n<kontext>\n${context}\n</kontext>\n\n` +
    'Skriv ett internt kunskapsbas-utkast som besvarar frågan enligt reglerna. Returnera endast JSON.';

  const claudeRes = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: DRAFT_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!claudeRes.ok) {
    return json({ error: `Claude API error (${claudeRes.status})` }, 502);
  }
  const data = (await claudeRes.json()) as { content?: Array<{ type: string; text?: string }> };
  const rawText = data.content?.find((c) => c.type === 'text')?.text ?? '';
  const jsonText = rawText.replace(/```json|```/g, '').trim();

  let parsed: { title?: string; draft?: string; needs?: string[]; usedSources?: string[] } = {};
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = { title: '', draft: rawText, needs: [], usedSources: [] };
  }

  return json(
    {
      title: parsed.title ?? '',
      draft: parsed.draft ?? rawText,
      needs: parsed.needs ?? [],
      usedSources: parsed.usedSources ?? [...new Set(chunks.map((c) => c.filename))],
      contextFound: chunks.length,
    },
    200,
  );
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  path: '/api/close-gap',
};
