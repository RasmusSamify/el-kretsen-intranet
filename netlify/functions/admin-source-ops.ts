import type { Config } from '@netlify/functions';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IngestError, replaceSourceInV2 } from './_shared/ingestV2';
import { reconstructSource } from './_shared/hierarchicalChunker';
import { checkSourceForContradictions } from './_shared/contradictions';

type Admin = SupabaseClient;

interface GetRequest {
  action: 'get';
  filename: string;
}
interface UpdateRequest {
  action: 'update';
  filename: string;
  content: string;
}
interface DeleteRequest {
  action: 'delete';
  filename: string;
}
type AdminRequest = GetRequest | UpdateRequest | DeleteRequest;

const MAX_CONTENT_BYTES = 1_500_000;

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
  const voyageKey = process.env.VOYAGE_API_KEY;
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!supabaseUrl || !serviceKey || !anonKey || !voyageKey) {
    return json({ error: 'Server not configured' }, 500);
  }
  if (adminEmails.length === 0) {
    return json({ error: 'ADMIN_EMAILS not configured on server' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }
  const jwt = authHeader.slice(7);

  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await verifier.auth.getUser(jwt);
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }
  const email = userData.user.email?.toLowerCase();
  if (!email || !adminEmails.includes(email)) {
    return json({ error: 'Admin role required' }, 403);
  }

  let body: AdminRequest;
  try {
    body = (await req.json()) as AdminRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.filename?.trim()) {
    return json({ error: 'filename required' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  switch (body.action) {
    case 'get':
      return handleGet(admin, body.filename);
    case 'update':
      return handleUpdate(admin, voyageKey, body.filename, body.content);
    case 'delete':
      return handleDelete(admin, body.filename);
    default:
      return json({ error: 'Unknown action' }, 400);
  }
};

async function handleGet(admin: Admin, filename: string): Promise<Response> {
  // Läs large-chunks från v2 — det är den fulla originaltexten ordnad i logiska stycken.
  // Detta är vad ELvis faktiskt söker i, så edit-vyn visar exakt vad RAG ser.
  const { data: chunks, error } = await admin
    .from('kb_chunks_v2')
    .select('chunk_index, text')
    .eq('filename', filename)
    .eq('chunk_level', 'large')
    .order('chunk_index', { ascending: true });

  if (error) return json({ error: `DB error: ${error.message}` }, 502);
  if (!chunks || chunks.length === 0) {
    return json({ error: 'Källan finns inte' }, 404);
  }

  const content = reconstructSource(chunks.map((c) => (c as { text: string }).text));

  return json(
    {
      filename,
      content,
      chunk_count: chunks.length,
      warning:
        chunks.length > 1
          ? 'Texten är rekonstruerad från chunks — små överlapp kan ha tagits bort. Granska innan du sparar.'
          : null,
    },
    200,
  );
}

async function handleUpdate(
  admin: Admin,
  voyageKey: string,
  filename: string,
  content: string,
): Promise<Response> {
  if (!content || content.length < 100) {
    return json({ error: 'För lite text — minst 100 tecken krävs' }, 400);
  }
  if (new Blob([content]).size > MAX_CONTENT_BYTES) {
    return json({ error: `För stort innehåll (max ${MAX_CONTENT_BYTES / 1024} KB)` }, 413);
  }

  // Bevara source_category från existerande rader om möjligt (för audit-filter etc).
  const { data: existing } = await admin
    .from('kb_chunks_v2')
    .select('source_category, quality_score')
    .eq('filename', filename)
    .limit(1);

  const sourceCategory =
    (existing?.[0] as { source_category?: string | null } | undefined)?.source_category ?? 'internal';
  const qualityScore =
    (existing?.[0] as { quality_score?: number | null } | undefined)?.quality_score ?? null;

  try {
    const result = await replaceSourceInV2(admin, voyageKey, filename, content, {
      sourceCategory,
      qualityScore,
    });

    await admin.from('kb_sources').upsert(
      { filename, title: filename, source_category: sourceCategory },
      { onConflict: 'filename', ignoreDuplicates: false },
    );

    // Direktkoll: en uppdaterad källa kan börja säga emot annat innehåll. Flagga
    // direkt i Granskning istället för att vänta på nattsvepet. Best-effort.
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        await checkSourceForContradictions(admin, anthropicKey, filename, { timeBudgetMs: 10_000 });
      } catch {
        /* best-effort */
      }
    }

    return json({ ok: true, filename, chunks: result.largeChunks }, 200);
  } catch (e) {
    if (e instanceof IngestError) {
      return json({ error: e.message }, e.status);
    }
    return json({ error: `Re-indexering misslyckades: ${(e as Error).message}` }, 502);
  }
}

async function handleDelete(admin: Admin, filename: string): Promise<Response> {
  const { error, count } = await admin
    .from('kb_chunks_v2')
    .delete({ count: 'exact' })
    .eq('filename', filename);
  if (error) return json({ error: `Delete failed: ${error.message}` }, 502);

  return json(
    {
      ok: true,
      filename,
      chunks_removed: count ?? 0,
    },
    200,
  );
}

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
  path: '/api/admin-source-ops',
};
