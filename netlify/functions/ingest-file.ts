import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { IngestError, replaceSourceInV2 } from './_shared/ingestV2';
import { requireAdmin } from './_shared/auth';

interface IngestFileRequest {
  filename: string;
  content: string;
}

interface IngestFileResponse {
  ok: true;
  source: string;
  chunks: number;
  tokens: number;
}

const MAX_CONTENT_BYTES = 1_500_000;

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  // Auth: admin-JWT (UI lägger till källa) ELLER intern cron-secret (server-till-server).
  // Skyddar kunskapsbasen mot att vem som helst injicerar innehåll.
  const cronSecret = process.env.CRON_SECRET;
  const provided = req.headers.get('x-cron-secret');
  const cronOk = !!cronSecret && provided === cronSecret;
  if (!cronOk) {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
  }

  const voyageKey = process.env.VOYAGE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!voyageKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured.' }, 500);
  }

  let body: IngestFileRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const filename = (body.filename ?? '').trim();
  const content = body.content ?? '';
  if (!filename) return json({ error: 'Filnamn krävs' }, 400);
  if (!content || content.length < 100) {
    return json({ error: 'För lite text — minst 100 tecken krävs' }, 400);
  }
  if (new Blob([content]).size > MAX_CONTENT_BYTES) {
    return json({ error: `För stort innehåll (max ${MAX_CONTENT_BYTES / 1024} KB)` }, 413);
  }

  const normalisedName = filename.endsWith('.txt') ? filename : `${filename}.txt`;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await replaceSourceInV2(supabase, voyageKey, normalisedName, content, {
      sourceCategory: 'internal',
    });

    await supabase.from('kb_sources').upsert(
      { filename: normalisedName, title: normalisedName, source_category: 'internal' },
      { onConflict: 'filename', ignoreDuplicates: false },
    );

    // "chunks" i UI = large chunks (logiska stycken som Claude får som kontext).
    // Small chunks är searcher-noder och döljs här för enkelhet.
    const payload: IngestFileResponse = {
      ok: true,
      source: normalisedName,
      chunks: result.largeChunks,
      tokens: result.totalTokens,
    };
    return json(payload, 200);
  } catch (e) {
    if (e instanceof IngestError) {
      return json({ error: e.message }, e.status);
    }
    return json({ error: `Ingest failed: ${(e as Error).message}` }, 502);
  }
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
  path: '/api/ingest-file',
};
