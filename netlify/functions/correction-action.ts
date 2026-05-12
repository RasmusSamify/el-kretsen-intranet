import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_shared/auth';

interface CorrectionActionRequest {
  correction_id: string;
  action: 'resolve' | 'ignore' | 'reopen';
}

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

  let body: CorrectionActionRequest;
  try {
    body = (await req.json()) as CorrectionActionRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.correction_id || !['resolve', 'ignore', 'reopen'].includes(body.action)) {
    return json({ error: 'correction_id and valid action required' }, 400);
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
          resolved_by: auth.user.id,
        };

  const { data, error } = await admin
    .from('ai_corrections')
    .update(update)
    .eq('id', body.correction_id)
    .select('id, status, resolved_at, resolved_by')
    .single();

  if (error) {
    return json({ error: `Update failed: ${error.message}` }, 502);
  }

  return json({ ok: true, correction: data }, 200);
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
  path: '/api/correction-action',
};
