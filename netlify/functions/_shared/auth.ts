import { createClient, type User } from '@supabase/supabase-js';

export type AuthOk = { ok: true; user: User; isAdmin: boolean };
export type AuthErr = { ok: false; response: Response };
export type AuthResult = AuthOk | AuthErr;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function errResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

type AuthEnv = { supabaseUrl: string; anonKey: string; adminEmails: string[] };

function readEnv(): AuthEnv | Response {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return errResponse('Server not configured (auth)', 500);
  }
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return { supabaseUrl, anonKey, adminEmails };
}

async function verify(
  env: AuthEnv,
  jwt: string,
): Promise<{ user: User; isAdmin: boolean } | null> {
  const verifier = createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getUser(jwt);
  if (error || !data.user) return null;
  const email = data.user.email?.toLowerCase();
  const isAdmin = !!email && env.adminEmails.includes(email);
  return { user: data.user, isAdmin };
}

export async function requireUser(req: Request): Promise<AuthResult> {
  const env = readEnv();
  if (env instanceof Response) return { ok: false, response: env };

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: errResponse('Missing Authorization header', 401) };
  }

  const verified = await verify(env, authHeader.slice(7));
  if (!verified) {
    return { ok: false, response: errResponse('Invalid or expired session', 401) };
  }
  return { ok: true, ...verified };
}

export async function requireAdmin(req: Request): Promise<AuthResult> {
  const result = await requireUser(req);
  if (!result.ok) return result;
  if (!result.isAdmin) {
    return { ok: false, response: errResponse('Admin role required', 403) };
  }
  return result;
}

export async function getOptionalUser(
  req: Request,
): Promise<{ user: User; isAdmin: boolean } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const env = readEnv();
  if (env instanceof Response) return null;

  try {
    return await verify(env, authHeader.slice(7));
  } catch {
    return null;
  }
}
