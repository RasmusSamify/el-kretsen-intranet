import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface FeeRequest {
  productDescription: string;
  quantity: number;
  unit: 'st' | 'kg';
}

interface FeeBreakdown {
  code: string;
  productName: string;
  unitFee: number;
  feeUnit: 'kr/st' | 'kr/kg';
  totalFee: number;
}

interface FeeResponse {
  matched: boolean;
  reasoning: string;
  primary: FeeBreakdown | null;
  green: FeeBreakdown | null;
  citations: string[];
  warning: string | null;
}

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const EMBEDDING_MODEL = 'voyage-3';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MATCH_THRESHOLD = 0.25;
const MATCH_COUNT = 10;

const SYSTEM_PROMPT = `Du är El-kretsens interna avgifts-kalkylator. Din uppgift är att:
1. Hitta den RÄTTA El-kretsen-produktkoden för en produkt som användaren beskriver.
2. Extrahera avgiften per enhet ur kunskapsbasen (EXAKT siffra, ingen gissning).
3. Räkna ut total-avgift baserat på användarens antal/vikt.

ABSOLUTA REGLER:
- Produktkoden och avgiften MÅSTE komma från <kunskapsbas>-taggen. Gissa aldrig.
- Avgiftsenheten är antingen kr/st eller kr/kg. Matcha mot användarens unit.
- Om kunskapsbasen inte entydigt pekar ut en kod för produkten, sätt matched=false och förklara varför.
- Om användarens unit (st/kg) inte stämmer mot avgiftsenheten (kr/st vs kr/kg), sätt "warning" med tydlig text.
- Returnera ENDAST giltig JSON:

{
  "matched": true,
  "reasoning": "Kort förklaring av varför denna kod valdes (1-2 meningar).",
  "primary": {
    "code": "B74",
    "productName": "Li-jon LFP – Litium-järnfosfat (LiFePO₄), uppladdningsbart",
    "unitFee": 10,
    "feeUnit": "kr/kg",
    "totalFee": 250
  },
  "green": {
    "code": null,
    "productName": null,
    "unitFee": null,
    "feeUnit": null,
    "totalFee": null
  },
  "citations": ["Prislista_2026_RAG.txt"],
  "warning": null
}

- "green" fylls i om det finns en G-variant av koden med lägre pris. Samma struktur, annars null överallt.
- "citations" är en lista med filnamn som informationen kom från.
- "warning" är null om allt är OK, annars en mening om t.ex. enhetsmissmatchning eller osäkerhet.`;

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

  let body: FeeRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const desc = (body.productDescription ?? '').trim();
  const quantity = Number(body.quantity);
  const unit = body.unit === 'kg' ? 'kg' : 'st';

  if (!desc) return json({ error: 'productDescription required' }, 400);
  if (!(quantity > 0 && isFinite(quantity))) return json({ error: 'quantity must be > 0' }, 400);

  // Embed: prioritise pricelist-relevant context
  const embedInput = `${desc} — avgift ${unit}`;
  let embedding: number[];
  try {
    const res = await fetch(VOYAGE_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${voyageKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: [embedInput], input_type: 'query' }),
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

  const { data: matches, error: matchError } = await supabase.rpc('match_kb_chunks', {
    query_embedding: embedding,
    match_threshold: MATCH_THRESHOLD,
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

  const context = chunks
    .map((c) => `[källa: ${c.filename}, stycke ${c.chunk_index + 1}]\n${c.text}`)
    .join('\n\n---\n\n');

  const userMessage = `Användaren vill veta El-kretsen-avgiften för:

Produkt: ${desc}
Antal: ${quantity} ${unit}

<kunskapsbas>
${context || '(inga relevanta chunks hittades)'}
</kunskapsbas>

Hitta rätt kod, läs avgiften och räkna ut totalen. Returnera endast JSON.`;

  const claudeRes = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    return json({ error: `Claude API error (${claudeRes.status}): ${errText}` }, 502);
  }

  const data = (await claudeRes.json()) as { content?: Array<{ type: string; text?: string }> };
  const rawText = data.content?.find((c) => c.type === 'text')?.text ?? '';
  const jsonText = rawText.replace(/```json|```/g, '').trim();

  let parsed: FeeResponse;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = {
      matched: false,
      reasoning: 'AI:n returnerade ett svar som inte gick att tolka. Försök med en tydligare produktbeskrivning.',
      primary: null,
      green: null,
      citations: [],
      warning: 'Parse-fel i AI-svaret.',
    };
  }

  return json(parsed, 200);
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
  path: '/api/fee-calculator',
};
