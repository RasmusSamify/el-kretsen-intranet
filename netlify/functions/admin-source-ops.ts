import type { Config } from '@netlify/functions';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { embeddingInput } from './_shared/contextPrefix';

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

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBEDDING_MODEL = 'voyage-3';
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 25;
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

  // Verifiera session + admin-roll
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
      return handleUpdate(admin, voyageKey, body.filename, body.content, userData.user.id);
    case 'delete':
      return handleDelete(admin, body.filename);
    default:
      return json({ error: 'Unknown action' }, 400);
  }
};

async function handleGet(
  admin: Admin,
  filename: string,
): Promise<Response> {
  // Rekonstruera text från chunks (sortera på chunk_index)
  const { data: chunks, error } = await admin
    .from('kb_chunks')
    .select('chunk_index, text')
    .eq('filename', filename)
    .order('chunk_index', { ascending: true });

  if (error) return json({ error: `DB error: ${error.message}` }, 502);
  if (!chunks || chunks.length === 0) {
    return json({ error: 'Källan finns inte' }, 404);
  }

  // Sammanfoga chunks — tappar överlapp mellan chunks men originaltext är inte
  // tillgänglig i databasen för uppladdade TXT-filer (sparades aldrig i bucket).
  // Nästa sparning skriver rekonstruerad + redigerad version tillbaka som ny helhet.
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const c of chunks) {
    const key = c.text.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c.text);
  }
  const content = deduped.join('\n\n');

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
  editedBy: string,
): Promise<Response> {
  if (!content || content.length < 100) {
    return json({ error: 'För lite text — minst 100 tecken krävs' }, 400);
  }
  if (new Blob([content]).size > MAX_CONTENT_BYTES) {
    return json({ error: `För stort innehåll (max ${MAX_CONTENT_BYTES / 1024} KB)` }, 413);
  }

  // Snapshot nuvarande chunks till kb_chunk_history INNAN uppdateringen
  const { data: currentChunks } = await admin
    .from('kb_chunks')
    .select('id, text, token_count, quality_score')
    .eq('filename', filename);

  if (currentChunks && currentChunks.length > 0) {
    const historyRows = await Promise.all(
      currentChunks.map(async (c) => {
        const { data: version } = await admin.rpc('kb_chunk_next_version', { p_chunk_id: c.id });
        return {
          chunk_id: c.id,
          version_number: (version as number | null) ?? 1,
          text: c.text,
          token_count: c.token_count,
          quality_score: c.quality_score,
          edited_by: editedBy,
        };
      }),
    );
    await admin.from('kb_chunk_history').insert(historyRows);
  }

  const chunks = chunkText(content, filename);

  const rows: Array<{
    filename: string;
    chunk_index: number;
    text: string;
    token_count: number;
    embedding: number[];
  }> = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const res = await fetch(VOYAGE_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${voyageKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch.map((c) => embeddingInput(c.filename, c.chunk_index, c.text)),
        input_type: 'document',
      }),
    });
    if (!res.ok) {
      return json({ error: `Voyage API error: ${res.status} ${await res.text()}` }, 502);
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    batch.forEach((c, idx) => {
      rows.push({
        filename: c.filename,
        chunk_index: c.chunk_index,
        text: c.text,
        token_count: Math.round(c.text.length / 4),
        embedding: data.data[idx].embedding,
      });
    });
  }

  // Replace: ta bort gamla chunks, sätt in nya
  const { error: delError } = await admin.from('kb_chunks').delete().eq('filename', filename);
  if (delError) return json({ error: `Delete old chunks failed: ${delError.message}` }, 502);

  const { error: insError } = await admin.from('kb_chunks').insert(rows);
  if (insError) return json({ error: `Insert new chunks failed: ${insError.message}` }, 502);

  // Ensure kb_sources exists and bump updated_at
  await admin.from('kb_sources').upsert(
    { filename, title: filename, source_category: 'internal' },
    { onConflict: 'filename', ignoreDuplicates: false },
  );

  return json({ ok: true, filename, chunks: rows.length }, 200);
}

async function handleDelete(
  admin: Admin,
  filename: string,
): Promise<Response> {
  const { error, count } = await admin
    .from('kb_chunks')
    .delete({ count: 'exact' })
    .eq('filename', filename);
  if (error) return json({ error: `Delete failed: ${error.message}` }, 502);
  return json({ ok: true, filename, chunks_removed: count ?? 0 }, 200);
}

function chunkText(text: string, filename: string) {
  const chunks: Array<{ filename: string; chunk_index: number; text: string }> = [];
  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  let buffer = '';
  let index = 0;
  const push = (t: string) => chunks.push({ filename, chunk_index: index++, text: t.trim() });
  for (const paragraph of paragraphs) {
    const p = paragraph.trim();
    if (!p) continue;
    if (buffer.length + p.length + 2 <= CHUNK_SIZE) {
      buffer = buffer ? `${buffer}\n\n${p}` : p;
    } else {
      if (buffer) {
        push(buffer);
        const tail = buffer.slice(Math.max(0, buffer.length - CHUNK_OVERLAP));
        buffer = `${tail}\n\n${p}`;
      } else {
        for (let i = 0; i < p.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          const end = Math.min(i + CHUNK_SIZE, p.length);
          push(p.slice(i, end));
          if (end === p.length) break;
        }
        buffer = '';
      }
    }
  }
  if (buffer) push(buffer);
  return chunks;
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
