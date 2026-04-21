import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface ReviewActionRequest {
  review_id: string;
  action: 'resolve' | 'ignore' | 'reopen';
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY; // används för att verifiera användarens JWT
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server not configured' }, 500);
  }

  // Verifiera användarsession via Authorization: Bearer <JWT>
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }
  const jwt = authHeader.slice(7);

  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await verifier.auth.getUser(jwt);
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }
  const userId = userData.user.id;

  let body: ReviewActionRequest;
  try {
    body = (await req.json()) as ReviewActionRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.review_id || !['resolve', 'ignore', 'reopen'].includes(body.action)) {
    return json({ error: 'review_id and valid action required' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const update =
    body.action === 'reopen'
      ? { status: 'pending' as const, resolved_at: null, resolved_by: null }
      : {
          status: body.action === 'resolve' ? ('resolved' as const) : ('ignored' as const),
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
        };

  const { data, error } = await admin
    .from('kb_review_queue')
    .update(update)
    .eq('id', body.review_id)
    .select('id, status, resolved_at, resolved_by')
    .single();

  if (error) {
    return json({ error: `Update failed: ${error.message}` }, 502);
  }

  return json({ ok: true, review: data }, 200);
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
  path: '/api/review-action',
};
