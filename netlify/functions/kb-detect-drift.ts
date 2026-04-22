import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'node-html-parser';

interface DriftRequest {
  batch_size?: number;
  offset?: number;
}

interface DriftResponse {
  sources_checked: number;
  drift_found: number;
  errors: number;
  batch_offset_next: number;
  completed: boolean;
  time_elapsed_ms: number;
}

// Hoppa över URL:er vi inte enkelt kan re-fetch:a utan login-flöde
const SKIP_DOMAINS = ['localhost', '127.0.0.1'];

// Tröskel för att anse en källa har drivit: text-similarity under 0.85
// ELLER storleksförändring över 10% räcker för flaggning.
const TEXT_SIMILARITY_THRESHOLD = 0.85;
const SIZE_CHANGE_THRESHOLD = 10.0;

// Netlify 26s cap — bryt vid 22s
const TIME_BUDGET_MS = 22_000;

// Max bytes per fetch (samma som ingest-url)
const MAX_CONTENT_BYTES = 1_500_000;

export default async (req: Request) => {
  const startedAt = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers.get('x-cron-secret');
  if (!cronSecret) return json({ error: 'CRON_SECRET not configured' }, 500);
  if (providedSecret !== cronSecret) return json({ error: 'Forbidden' }, 403);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  let body: DriftRequest = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      body = (await req.json()) as DriftRequest;
    } catch {
      /* empty body */
    }
  }
  const batchSize = Math.max(1, Math.min(20, body.batch_size ?? 3));
  const offset = Math.max(0, body.offset ?? 0);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Hämta distinkta URL-källor (source_category='website') sorterade på filename
  // för deterministisk paginering.
  const { data: sources, error: sourcesError } = await supabase.rpc('list_website_sources', {
    page_offset: offset,
    page_limit: batchSize,
  });

  if (sourcesError) {
    return json({ error: `Failed to list sources: ${sourcesError.message}` }, 502);
  }

  const { data: totalRow } = await supabase.rpc('count_website_sources');
  const totalSources = (totalRow as number | null) ?? 0;

  let checked = 0;
  let driftFound = 0;
  let errors = 0;

  for (const s of (sources ?? []) as Array<{ filename: string; chunk_count: number }>) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    const filename = s.filename;
    const url = filenameToUrl(filename);
    if (!url) {
      checked++;
      continue;
    }
    if (SKIP_DOMAINS.some((d) => filename.startsWith(d))) {
      checked++;
      continue;
    }

    // Hämta nuvarande lagrad text för samma källa
    const { data: oldChunks } = await supabase
      .from('kb_chunks')
      .select('text')
      .eq('filename', filename)
      .order('chunk_index', { ascending: true });

    const oldText = (oldChunks ?? []).map((c) => c.text).join('\n\n');
    const oldSize = oldText.length;

    // Re-fetch HTML
    let status = 0;
    let fetchError: string | null = null;
    let newText = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ElkretsenKBIngester/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      status = res.status;
      if (!res.ok) {
        fetchError = `HTTP ${res.status}`;
      } else {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_CONTENT_BYTES) {
          fetchError = 'Page too large';
        } else {
          const html = new TextDecoder('utf-8').decode(buf);
          newText = extractPlainText(html);
        }
      }
    } catch (e) {
      fetchError = (e as Error).message;
    }

    // Om fetch misslyckas — logga ändå som drift-event med fetch_error så
    // admin får syn på döda länkar.
    if (fetchError || !newText) {
      await supabase.from('kb_source_drift').insert({
        filename,
        text_similarity: 0,
        size_change_percent: 0,
        chunks_before: (oldChunks ?? []).length,
        fetch_status: status,
        fetch_error: fetchError ?? 'empty-body',
        status: 'pending',
      });
      errors++;
      checked++;
      continue;
    }

    // Beräkna similarity (ngram-jaccard är robust för textbrus) + storleksförändring
    const similarity = ngramSimilarity(oldText, newText, 5);
    const sizeChange = oldSize === 0 ? 100 : ((newText.length - oldSize) / oldSize) * 100;

    const hasDrift =
      similarity < TEXT_SIMILARITY_THRESHOLD || Math.abs(sizeChange) > SIZE_CHANGE_THRESHOLD;

    if (hasDrift) {
      const { sampleRemoved, sampleAdded } = sampleDiffs(oldText, newText);
      await supabase.from('kb_source_drift').insert({
        filename,
        text_similarity: similarity.toFixed(3),
        size_change_percent: sizeChange.toFixed(1),
        chunks_before: (oldChunks ?? []).length,
        sample_removed: sampleRemoved,
        sample_added: sampleAdded,
        fetch_status: status,
        status: 'pending',
      });
      driftFound++;
    }

    checked++;
  }

  const nextOffset = offset + checked;
  const completed = nextOffset >= totalSources;

  await supabase.from('kb_audit_state').upsert(
    {
      key: 'drift_offset',
      value: {
        next_offset: completed ? 0 : nextOffset,
        last_run_at: new Date().toISOString(),
        last_sources_checked: checked,
        last_drift_found: driftFound,
        last_errors: errors,
        last_completed: completed,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );

  const response: DriftResponse = {
    sources_checked: checked,
    drift_found: driftFound,
    errors,
    batch_offset_next: completed ? 0 : nextOffset,
    completed,
    time_elapsed_ms: Date.now() - startedAt,
  };

  return json(response, 200);
};

// Konvertera lagrat filename (host+path+search) till absolut URL.
function filenameToUrl(filename: string): string | null {
  if (!filename || filename.includes('\n')) return null;
  const clean = filename.replace(/^\/+/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}/.test(clean)) return null;
  return `https://${clean}`;
}

function extractPlainText(html: string): string {
  const root = parse(html, {
    blockTextElements: { script: false, noscript: false, style: false },
  });
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

  return contentNode.text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

// N-gram Jaccard-similarity: andel av gemensamma character n-grams.
// Stabilare än Levenshtein på långa dokument + snabbt nog att köra inline.
function ngramSimilarity(a: string, b: string, n = 5): number {
  if (!a.length || !b.length) return 0;
  const setA = ngrams(a, n);
  const setB = ngrams(b, n);
  let intersection = 0;
  for (const g of setA) if (setB.has(g)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function ngrams(s: string, n: number): Set<string> {
  const cleaned = s.replace(/\s+/g, ' ').toLowerCase();
  const out = new Set<string>();
  for (let i = 0; i <= cleaned.length - n; i++) {
    out.add(cleaned.slice(i, i + n));
  }
  return out;
}

// Hitta en representativ rad som finns i den ena men inte andra.
function sampleDiffs(oldText: string, newText: string): { sampleRemoved: string; sampleAdded: string } {
  const oldLines = new Set(oldText.split('\n').map((l) => l.trim()).filter(Boolean));
  const newLines = new Set(newText.split('\n').map((l) => l.trim()).filter(Boolean));
  const removed = [...oldLines].find((l) => l.length > 30 && !newLines.has(l)) ?? '';
  const added = [...newLines].find((l) => l.length > 30 && !oldLines.has(l)) ?? '';
  return {
    sampleRemoved: removed.slice(0, 500),
    sampleAdded: added.slice(0, 500),
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-cron-secret',
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
  path: '/api/kb-detect-drift',
};
