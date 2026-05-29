import type { Config } from '@netlify/functions';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from './_shared/auth';

/**
 * Schemalagd om-crawl av el-kretsen.se. Webbsidan uppdateras löpande, så vi
 * indexerar om den regelbundet via samma /api/ingest-url-endpoint som den
 * manuella crawlern. Netlify-functions har ~26s tak, så vi processar en liten
 * batch per anrop och sparar offset i kb_audit_state['crawl_state']. pg_cron
 * kör 'start' veckovis (bygger ny URL-lista) och 'advance' var 10:e minut tills
 * listan är klar. När den är klar skrivs en heartbeat i kb_audit_state['last_crawl'].
 *
 * Auth: x-cron-secret (pg_cron) ELLER admin-JWT (manuell knapp i Systemstatus).
 */

const SITEMAPS = [
  'https://www.el-kretsen.se/post-sitemap1.xml',
  'https://www.el-kretsen.se/page-sitemap1.xml',
];
const BATCH_URLS = 6;
const TIME_BUDGET_MS = 22_000;
const STATE_KEY = 'crawl_state';
const HEARTBEAT_KEY = 'last_crawl';

interface CrawlState {
  urls: string[];
  offset: number;
  ok: number;
  failed: number;
  skipped: number;
  chunks: number;
  started_at: string;
  completed: boolean;
}

export default async (req: Request) => {
  const startedAt = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured' }, 500);
  }

  // Auth: cron-secret eller admin
  const cronSecret = process.env.CRON_SECRET;
  const provided = req.headers.get('x-cron-secret');
  const cronOk = !!cronSecret && !!provided && provided === cronSecret;
  if (!cronOk) {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
  }

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* tom body = advance */
  }
  const action = body.action === 'start' ? 'start' : 'advance';

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let state = await loadState(admin);

  // Avgör om vi ska starta en ny crawl eller fortsätta en pågående
  if (action === 'start' || !state || state.completed) {
    if (action === 'advance') {
      // Inget pågår — no-op (det vanliga utfallet för var-10:e-minut-jobbet)
      return json({ idle: true, heartbeat: await loadHeartbeat(admin) }, 200);
    }
    const urls = await buildUrlList();
    if (urls.length === 0) {
      return json({ error: 'Inga URL:er hittades i sitemaps' }, 502);
    }
    state = {
      urls,
      offset: 0,
      ok: 0,
      failed: 0,
      skipped: 0,
      chunks: 0,
      started_at: new Date().toISOString(),
      completed: false,
    };
  }

  const ingestUrl = new URL('/api/ingest-url', new URL(req.url).origin).toString();
  const { urls } = state;
  let { offset, ok, failed, skipped, chunks } = state;
  let processed = 0;

  while (offset < urls.length && processed < BATCH_URLS && Date.now() - startedAt < TIME_BUDGET_MS) {
    const url = urls[offset];
    try {
      const res = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Intern auth mot den nu låsta ingest-endpointen
          'x-cron-secret': cronSecret ?? '',
        },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; chunks?: number };
      if (res.status === 200 && data.ok) {
        ok += 1;
        chunks += data.chunks ?? 0;
      } else if (res.status === 422) {
        skipped += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
    offset += 1;
    processed += 1;
  }

  const completed = offset >= urls.length;
  const nextState: CrawlState = { urls, offset, ok, failed, skipped, chunks, started_at: state.started_at, completed };
  await saveState(admin, nextState);

  if (completed) {
    await admin.from('kb_audit_state').upsert(
      {
        key: HEARTBEAT_KEY,
        value: {
          completed_at: new Date().toISOString(),
          started_at: state.started_at,
          total: urls.length,
          ok,
          failed,
          skipped,
          chunks,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  }

  return json(
    {
      action,
      processed,
      offset,
      total: urls.length,
      completed,
      ok,
      failed,
      skipped,
      chunks,
      time_elapsed_ms: Date.now() - startedAt,
    },
    200,
  );
};

async function loadState(admin: SupabaseClient): Promise<CrawlState | null> {
  const { data } = await admin.from('kb_audit_state').select('value').eq('key', STATE_KEY).maybeSingle();
  return (data?.value as CrawlState | undefined) ?? null;
}

async function loadHeartbeat(admin: SupabaseClient): Promise<unknown> {
  const { data } = await admin.from('kb_audit_state').select('value').eq('key', HEARTBEAT_KEY).maybeSingle();
  return data?.value ?? null;
}

async function saveState(admin: SupabaseClient, state: CrawlState): Promise<void> {
  await admin.from('kb_audit_state').upsert(
    { key: STATE_KEY, value: state, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
}

async function buildUrlList(): Promise<string[]> {
  const urls: string[] = [];
  for (const sm of SITEMAPS) {
    try {
      const res = await fetch(sm, { headers: { 'User-Agent': 'ElvisHubCrawler/1.0' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const re = /<loc>([^<]+)<\/loc>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) {
        const u = m[1].trim();
        if (u.includes('?lang=en')) continue;
        if (/\.(pdf|jpg|jpeg|png|xml)$/i.test(u)) continue;
        if (!urls.includes(u)) urls.push(u);
      }
    } catch {
      /* hoppa över sitemap som inte svarar */
    }
  }
  return urls;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
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
  path: '/api/scheduled-crawl',
};
