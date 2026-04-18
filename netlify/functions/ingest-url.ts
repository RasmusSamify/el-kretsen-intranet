import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'node-html-parser';

interface IngestRequest {
  url: string;
}

interface IngestResponse {
  ok: true;
  source: string;
  title: string | null;
  chunks: number;
  tokens: number;
}

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBEDDING_MODEL = 'voyage-3';
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 25;
const MAX_CONTENT_BYTES = 1_500_000; // 1.5 MB safety cap

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
    return json({ error: 'Server not configured: saknar VOYAGE_API_KEY, SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.' }, 500);
  }

  let body: IngestRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const rawUrl = (body.url ?? '').trim();
  let url: URL;
  try {
    url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol)) throw new Error('Only http(s) URLs');
  } catch {
    return json({ error: 'Ogiltig URL. Måste börja med http:// eller https://' }, 400);
  }

  // Step 1: fetch page
  let html: string;
  let title: string | null = null;
  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ElkretsenKBIngester/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      return json({ error: `Kunde inte hämta sidan (HTTP ${res.status} från ${url.host}).` }, 502);
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_CONTENT_BYTES) {
      return json({ error: `Sidan är för stor (${Math.round(buffer.byteLength / 1024)} KB, max 1500 KB).` }, 413);
    }
    html = new TextDecoder('utf-8').decode(buffer);
  } catch (e) {
    return json({ error: `Nätverksfel vid hämtning: ${(e as Error).message}` }, 502);
  }

  // Step 2: extract readable text
  const root = parse(html, {
    blockTextElements: { script: false, noscript: false, style: false },
  });

  title = root.querySelector('title')?.innerText?.trim() || null;

  // Prefer main/article/#content; fall back to body
  const contentNode =
    root.querySelector('main') ||
    root.querySelector('article') ||
    root.querySelector('#content') ||
    root.querySelector('[role="main"]') ||
    root.querySelector('body') ||
    root;

  for (const sel of ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', '.cookie', '.cookies', '.navigation']) {
    contentNode.querySelectorAll(sel).forEach((n) => n.remove());
  }

  const rawText = contentNode.text.replace(/\r\n/g, '\n');
  const text = rawText
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');

  if (text.length < 200) {
    return json({ error: 'Hittade för lite text på sidan (< 200 tecken). Kan vara JS-genererad innehåll som inte går att skrapa server-side.' }, 422);
  }

  // Step 3: chunk
  const filename = canonicalFilename(url);
  const chunks = chunkText(text, filename);

  // Step 4: embed in batches
  const embedded: Array<{ filename: string; chunk_index: number; text: string; token_count: number; embedding: number[] }> = [];
  let totalTokens = 0;
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
        input: batch.map((c) => c.text),
        input_type: 'document',
      }),
    });
    if (!res.ok) {
      return json({ error: `Voyage API error: ${res.status} ${await res.text()}` }, 502);
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }>; usage?: { total_tokens?: number } };
    totalTokens += data.usage?.total_tokens ?? 0;
    batch.forEach((c, idx) => {
      embedded.push({
        filename: c.filename,
        chunk_index: c.chunk_index,
        text: c.text,
        token_count: Math.round(c.text.length / 4),
        embedding: data.data[idx].embedding,
      });
    });
  }

  // Step 5: upsert to Supabase (replace any previous ingestion of the same URL)
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await supabase.from('kb_chunks').delete().eq('filename', filename);
  const { error: insertError } = await supabase.from('kb_chunks').insert(embedded);
  if (insertError) {
    return json({ error: `DB-insert misslyckades: ${insertError.message}` }, 502);
  }

  const payload: IngestResponse = {
    ok: true,
    source: filename,
    title,
    chunks: embedded.length,
    tokens: totalTokens,
  };
  return json(payload, 200);
};

function canonicalFilename(url: URL): string {
  // Store URL as filename — strip fragment, keep host + path for readability
  const clean = `${url.host}${url.pathname}${url.search}`;
  // Keep it under Postgres text limits (way larger than 1K, safe)
  return clean.length > 400 ? `${url.host}${url.pathname.slice(0, 300)}...` : clean;
}

function chunkText(text: string, filename: string) {
  const chunks: Array<{ filename: string; chunk_index: number; text: string }> = [];
  const paragraphs = text.split(/\n\s*\n/);
  let buffer = '';
  let index = 0;

  const push = (t: string) => chunks.push({ filename, chunk_index: index++, text: t });

  for (const paragraph of paragraphs) {
    if (buffer.length + paragraph.length + 2 <= CHUNK_SIZE) {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    } else {
      if (buffer) {
        push(buffer);
        const tail = buffer.slice(Math.max(0, buffer.length - CHUNK_OVERLAP));
        buffer = `${tail}\n\n${paragraph}`;
      } else {
        for (let i = 0; i < paragraph.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          const end = Math.min(i + CHUNK_SIZE, paragraph.length);
          push(paragraph.slice(i, end));
          if (end === paragraph.length) break;
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
  path: '/api/ingest-url',
};
