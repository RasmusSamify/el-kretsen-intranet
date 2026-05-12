import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_shared/auth';

interface SubmitMailTrainingRequest {
  customer_email: string;
  ai_draft?: string | null;
  correct_reply: string;
  language: 'sv' | 'en';
  user_note?: string | null;
}

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBEDDING_MODEL = 'voyage-3';

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const voyageKey = process.env.VOYAGE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!voyageKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured' }, 500);
  }

  let body: SubmitMailTrainingRequest;
  try {
    body = (await req.json()) as SubmitMailTrainingRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const customerEmail = (body.customer_email ?? '').trim();
  const correctReply = (body.correct_reply ?? '').trim();
  const language: 'sv' | 'en' = body.language === 'en' ? 'en' : 'sv';

  if (!customerEmail || customerEmail.length < 20) {
    return json({ error: 'customer_email krävs (minst 20 tecken)' }, 400);
  }
  if (!correctReply || correctReply.length < 20) {
    return json({ error: 'correct_reply krävs (minst 20 tecken)' }, 400);
  }
  if (customerEmail.length > 15000 || correctReply.length > 15000) {
    return json({ error: 'För långt innehåll (max 15 000 tecken per fält)' }, 413);
  }

  // Embedda kundmailet — det är "query"-sidan i framtida retrieval, men vi
  // lagrar som document så att nya inkommande mail (query) söker mot vår
  // växande corpus av kända kundmail (documents). Voyage rekommenderar
  // det matchande paret.
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
        input_type: 'document',
      }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    embedding = data.data[0].embedding;
  } catch (e) {
    return json({ error: `Embedding failed: ${(e as Error).message}` }, 502);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from('mail_training_pairs')
    .insert({
      customer_email: customerEmail,
      ai_draft: body.ai_draft?.trim() || null,
      correct_reply: correctReply,
      language,
      embedding,
      user_note: body.user_note?.trim().slice(0, 1000) || null,
      submitted_by: auth.user.id,
    })
    .select('id')
    .single();

  if (error) {
    return json({ error: `DB-insert misslyckades: ${error.message}` }, 502);
  }

  return json({ ok: true, id: data.id }, 200);
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
  path: '/api/submit-mail-training',
};
