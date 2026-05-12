import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_shared/auth';

interface SubmitCorrectionRequest {
  question: string;
  original_answer: string;
  correction_type: 'wrong_source' | 'outdated_source' | 'missing_in_kb';
  cited_source?: string | null;
  suggested_source?: string | null;
  user_note?: string | null;
}

const VALID_TYPES = ['wrong_source', 'outdated_source', 'missing_in_kb'] as const;

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured' }, 500);
  }

  let body: SubmitCorrectionRequest;
  try {
    body = (await req.json()) as SubmitCorrectionRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.question?.trim() || !body.original_answer?.trim()) {
    return json({ error: 'question och original_answer krävs' }, 400);
  }
  if (!VALID_TYPES.includes(body.correction_type)) {
    return json({ error: 'Ogiltig correction_type' }, 400);
  }
  if (body.correction_type === 'wrong_source' && !body.suggested_source?.trim()) {
    return json({ error: 'suggested_source krävs när fel källa hänvisades' }, 400);
  }
  if (body.correction_type === 'outdated_source' && !body.cited_source?.trim()) {
    return json({ error: 'cited_source krävs när källa är inaktuell' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from('ai_corrections')
    .insert({
      question: body.question.trim().slice(0, 2000),
      original_answer: body.original_answer.slice(0, 8000),
      correction_type: body.correction_type,
      cited_source: body.cited_source?.trim() || null,
      suggested_source: body.suggested_source?.trim() || null,
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
  path: '/api/submit-correction',
};
