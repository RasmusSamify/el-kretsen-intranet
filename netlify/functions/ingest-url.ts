import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'node-html-parser';
import { IngestError, replaceSourceInV2 } from './_shared/ingestV2';

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
    .filter((line) => line.length > 0 && !isKnownBoilerplate(line))
    .join('\n');

  if (text.length < 200) {
    return json({ error: 'Hittade för lite text på sidan (< 200 tecken). Kan vara JS-genererad innehåll som inte går att skrapa server-side.' }, 422);
  }

  // Step 3: chunk + embed + insert via shared v2-pipeline
  const filename = canonicalFilename(url);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await replaceSourceInV2(supabase, voyageKey, filename, text, {
      sourceCategory: 'website',
    });

    await supabase.from('kb_sources').upsert(
      { filename, title, source_category: 'website' },
      { onConflict: 'filename', ignoreDuplicates: false },
    );

    const payload: IngestResponse = {
      ok: true,
      source: filename,
      title,
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

const BOILERPLATE_PATTERNS: RegExp[] = [
  /^<!DOCTYPE svg PUBLIC .+?svg11\.dtd">$/i,
  /^Skriv ut<\?xml version=.+?\?>$/i,
  /^<\?xml version=.+?\?>$/i,
  /^Skriv ut$/i,
  /^Nyare artiklar.{0,3}Äldre artiklar$/i,
  /^Cookie.?installningar$/i,
  /^Acceptera alla cookies$/i,
];

function isKnownBoilerplate(line: string): boolean {
  return BOILERPLATE_PATTERNS.some((p) => p.test(line));
}

function canonicalFilename(url: URL): string {
  const clean = `${url.host}${url.pathname}${url.search}`;
  return clean.length > 400 ? `${url.host}${url.pathname.slice(0, 300)}...` : clean;
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
