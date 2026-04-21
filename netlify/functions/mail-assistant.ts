import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface MailAssistantRequest {
  customerEmail: string;
  responseLanguage: 'sv' | 'en';
  sendersName?: string;
  tone?: 'formal' | 'friendly';
}

interface MailAssistantResponse {
  reply: string;
  summary: string;
  sourceFiles: string[];
  gaps: string[];
  language: 'sv' | 'en';
}

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const EMBEDDING_MODEL = 'voyage-3';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MATCH_COUNT = 12;

const SYSTEM_PROMPT_SV = `Du är El-kretsens interna mail-assistent. Din uppgift är att hjälpa El-kretsens medarbetare att svara på inkommande kundmail om producentansvar, batterier, WEEE, avgifter och compliance.

ABSOLUTA REGLER:
1. Faktapåståenden får ENDAST grunda sig på innehåll i <kunskapsbas>-taggen. Hitta aldrig på siffror, paragrafer eller priser.
2. Om en del av kundens fråga saknar källa i kunskapsbasen — nämn det INTE i svaret utan listar det separat under "gaps" i JSON-svaret.
3. Svara på SVENSKA oavsett kundens språk.
4. Professionell men varm ton, som El-kretsens kundtjänst.
5. Börja med hälsning ("Hej" eller "Hej [namn]" om namn finns i mailet).
6. Avsluta med en vänlig signatur ("Vänliga hälsningar, El-kretsen").
7. Struktur: bekräfta att du förstått frågan → besvara punkt för punkt → erbjud fortsatt dialog.

SVARSFORMAT — returnera ENDAST giltig JSON:
{
  "reply": "Hela mail-svaret som en text, redo att klistras in och skickas.",
  "summary": "1-2 meningar som sammanfattar kundens fråga för Linnea.",
  "gaps": ["Punkt 1 som saknas i kunskapsbasen", "Punkt 2 ..."]
}

VIKTIGT om gaps: om kunden frågar om något som kunskapsbasen INTE täcker (t.ex. specifika priser för kunder i vissa länder, rådgivning utanför ramverket) — nämn det inte i "reply", lista i "gaps" så att Linnea kan fylla i det manuellt innan hon skickar mailet.`;

const SYSTEM_PROMPT_EN = `You are El-kretsen's internal mail assistant. Your task is to help El-kretsen staff reply to incoming customer emails about producer responsibility, batteries, WEEE, fees, and compliance.

ABSOLUTE RULES:
1. Factual claims may ONLY be grounded in the <kunskapsbas> (knowledge base) tag. Never invent numbers, paragraphs, or prices.
2. If part of the customer's question lacks sources in the knowledge base, DO NOT mention it in the reply — list it separately under "gaps" in the JSON response.
3. Reply in ENGLISH regardless of the original mail language.
4. Professional but warm tone, like El-kretsen's customer service team.
5. Start with a greeting ("Hello" or "Hello [name]" if a name is present).
6. End with a friendly signature ("Best regards, El-kretsen").
7. Structure: acknowledge the question → answer point by point → offer follow-up dialogue.

RESPONSE FORMAT — return ONLY valid JSON:
{
  "reply": "The complete mail response as plain text, ready to paste and send.",
  "summary": "1-2 sentences summarising the customer's question for Linnea.",
  "gaps": ["Point 1 not covered in knowledge base", "Point 2 ..."]
}

IMPORTANT about gaps: if the customer asks about something the knowledge base does NOT cover (e.g. country-specific pricing, advice outside our remit) — do not mention it in "reply", list it in "gaps" so Linnea can fill it in manually before sending.`;

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const voyageKey = process.env.VOYAGE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!voyageKey || !anthropicKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured.' }, 500);
  }

  let body: MailAssistantRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const customerEmail = (body.customerEmail ?? '').trim();
  if (!customerEmail) return json({ error: 'customerEmail required' }, 400);
  if (customerEmail.length > 15000) {
    return json({ error: 'Mail för långt (max 15 000 tecken).' }, 400);
  }

  const lang: 'sv' | 'en' = body.responseLanguage === 'en' ? 'en' : 'sv';

  // Embed the whole customer mail so we retrieve chunks that match the mail's topics
  let embedding: number[];
  try {
    const res = await fetch(VOYAGE_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${voyageKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: [customerEmail],
        input_type: 'query',
      }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    embedding = data.data[0].embedding;
  } catch (e) {
    return json({ error: `Embedding failed: ${(e as Error).message}` }, 502);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: matches, error: matchError } = await supabase.rpc('match_kb_chunks_hybrid', {
    query_text: customerEmail.slice(0, 2000),
    query_embedding: embedding,
    match_count: MATCH_COUNT,
  });
  if (matchError) return json({ error: `DB match failed: ${matchError.message}` }, 502);

  const chunks = (matches ?? []) as Array<{
    id: string;
    filename: string;
    chunk_index: number;
    text: string;
    similarity: number;
  }>;

  const context = chunks.length === 0
    ? '(ingen relevant information hittades i kunskapsbasen)'
    : chunks
        .map((c) => `[källa: ${c.filename}, stycke ${c.chunk_index + 1}]\n${c.text}`)
        .join('\n\n---\n\n');

  const userMessage =
    lang === 'sv'
      ? `Här är mailet från kunden:\n\n<kundmail>\n${customerEmail}\n</kundmail>\n\n<kunskapsbas>\n${context}\n</kunskapsbas>\n\nGenerera ett professionellt svar på svenska och returnera endast JSON enligt formatet.`
      : `Here is the customer's email:\n\n<customer_mail>\n${customerEmail}\n</customer_mail>\n\n<kunskapsbas>\n${context}\n</kunskapsbas>\n\nGenerate a professional reply in English and return only JSON per the specified format.`;

  const claudeRes = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      temperature: 0,
      system: lang === 'sv' ? SYSTEM_PROMPT_SV : SYSTEM_PROMPT_EN,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    return json({ error: `Claude API error (${claudeRes.status}): ${errText}` }, 502);
  }

  const data = (await claudeRes.json()) as { content?: Array<{ type: string; text?: string }> };
  const rawText = data.content?.find((c) => c.type === 'text')?.text ?? '';

  // Parse JSON — strip potential markdown fences
  const jsonText = rawText.replace(/```json|```/g, '').trim();
  let parsed: { reply?: string; summary?: string; gaps?: string[] } = {};
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Claude sometimes returns plain text — fall back to raw
    parsed = { reply: rawText, summary: '', gaps: [] };
  }

  const sourceFiles = [...new Set(chunks.map((c) => c.filename))];

  const payload: MailAssistantResponse = {
    reply: parsed.reply ?? rawText,
    summary: parsed.summary ?? '',
    gaps: parsed.gaps ?? [],
    sourceFiles,
    language: lang,
  };

  return json(payload, 200);
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
  path: '/api/mail-assistant',
};
