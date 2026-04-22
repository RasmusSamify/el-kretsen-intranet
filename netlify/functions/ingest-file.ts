import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { embeddingInput } from './_shared/contextPrefix';

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

  const chunks = chunkText(content, normalisedName);

  let totalTokens = 0;
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
        // Embedda med kontext-prefix för bättre dokumentsäparation
        input: batch.map((c) => embeddingInput(c.filename, c.chunk_index, c.text)),
        input_type: 'document',
      }),
    });
    if (!res.ok) {
      return json({ error: `Voyage API error: ${res.status} ${await res.text()}` }, 502);
    }
    const data = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
      usage?: { total_tokens?: number };
    };
    totalTokens += data.usage?.total_tokens ?? 0;
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await supabase.from('kb_chunks').delete().eq('filename', normalisedName);
  const { error: insertError } = await supabase.from('kb_chunks').insert(rows);
  if (insertError) {
    return json({ error: `DB-insert misslyckades: ${insertError.message}` }, 502);
  }

  await supabase.from('kb_sources').upsert(
    { filename: normalisedName, title: normalisedName, source_category: 'internal' },
    { onConflict: 'filename', ignoreDuplicates: false },
  );

  const payload: IngestFileResponse = {
    ok: true,
    source: normalisedName,
    chunks: rows.length,
    tokens: totalTokens,
  };
  return json(payload, 200);
};

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
  path: '/api/ingest-file',
};
