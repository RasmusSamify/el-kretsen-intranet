import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface FeedbackRequest {
  feature: 'mail_assistant' | 'ai_search';
  reference_id?: string | null;
  rating: 'up' | 'down';
  comment?: string | null;
}

const VALID_FEATURES = ['mail_assistant', 'ai_search'] as const;
const VALID_RATINGS = ['up', 'down'] as const;

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server not configured' }, 500);
  }

  let body: FeedbackRequest;
  try {
    body = (await req.json()) as FeedbackRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!VALID_FEATURES.includes(body.feature)) {
    return json({ error: `Invalid feature (must be: ${VALID_FEATURES.join(', ')})` }, 400);
  }
  if (!VALID_RATINGS.includes(body.rating)) {
    return json({ error: `Invalid rating (must be: ${VALID_RATINGS.join(', ')})` }, 400);
  }

  const comment = (body.comment ?? '').trim();
  if (comment.length > 2000) {
    return json({ error: 'Comment too long (max 2000 chars)' }, 400);
  }

  // Valfri användaridentifiering — feedback accepteras även från anonyma sessioner
  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const verifier = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData } = await verifier.auth.getUser(authHeader.slice(7));
      userId = userData.user?.id ?? null;
    } catch {
      /* ignore */
    }
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: insertError } = await admin.from('answer_feedback').insert({
    user_id: userId,
    feature: body.feature,
    reference_id: body.reference_id ?? null,
    rating: body.rating,
    comment: comment.length > 0 ? comment : null,
  });

  if (insertError) {
    return json({ error: `DB insert failed: ${insertError.message}` }, 502);
  }

  return json({ ok: true }, 200);
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
  path: '/api/answer-feedback',
};
