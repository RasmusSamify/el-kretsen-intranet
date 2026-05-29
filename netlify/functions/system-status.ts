import type { Config } from '@netlify/functions';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from './_shared/auth';

/**
 * Live systemstatus för Systemstatus-sidan. Pingar externa beroenden
 * (Supabase, Anthropic, Voyage) i realtid och samlar "senast uppdaterat"-fakta
 * (kunskapsbas, crawl-heartbeat, nattlig audit, drift-koll). Kräver inloggning.
 */

const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';
const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const PING_TIMEOUT_MS = 6000;

interface ServiceStatus {
  key: string;
  label: string;
  ok: boolean;
  latency_ms: number | null;
  detail: string;
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Kör alla live-pingar parallellt
  const [supabaseStatus, anthropicStatus, voyageStatus, facts] = await Promise.all([
    checkService('supabase', 'Databas & inloggning', async () => {
      const { error } = await admin.from('kb_audit_state').select('key', { head: true, count: 'exact' });
      if (error) throw new Error(error.message);
      return 'Kunskapsbas, loggar och inloggning svarar';
    }),
    checkService('anthropic', 'AI-språkmodell', async () => {
      if (!anthropicKey) throw new Error('AI-nyckel saknas i miljön');
      const res = await fetchWithTimeout(ANTHROPIC_MODELS_URL, {
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'Skriver och tolkar svar — fungerar';
    }),
    checkService('voyage', 'Semantisk sökmotor', async () => {
      if (!voyageKey) throw new Error('Sök-nyckel saknas i miljön');
      const res = await fetchWithTimeout(VOYAGE_EMBEDDING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${voyageKey}` },
        body: JSON.stringify({ model: 'voyage-3', input: ['ping'], input_type: 'query' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'Hittar rätt avsnitt i kunskapsbasen';
    }),
    collectFacts(admin),
  ]);

  const services: ServiceStatus[] = [
    supabaseStatus,
    anthropicStatus,
    voyageStatus,
    {
      key: 'netlify',
      label: 'Webbhotell (CDN)',
      ok: true,
      latency_ms: null,
      detail: 'Levererar appen snabbt och kör funktionerna — online',
    },
  ];

  return json({ checked_at: new Date().toISOString(), services, facts }, 200);
};

async function checkService(
  key: string,
  label: string,
  fn: () => Promise<string>,
): Promise<ServiceStatus> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { key, label, ok: true, latency_ms: Date.now() - t0, detail };
  } catch (e) {
    return { key, label, ok: false, latency_ms: Date.now() - t0, detail: (e as Error).message };
  }
}

async function collectFacts(admin: SupabaseClient) {
  const [sourcesAgg, websiteAgg, chunksCount, sourceCount, auditState, crawlHeartbeat, crawlState, drift, reviewPending] =
    await Promise.all([
      admin.from('kb_sources').select('updated_at').order('updated_at', { ascending: false }).limit(1),
      admin
        .from('kb_sources')
        .select('updated_at')
        .eq('source_category', 'website')
        .order('updated_at', { ascending: false })
        .limit(1),
      admin.from('kb_chunks_v2').select('id', { head: true, count: 'exact' }).eq('chunk_level', 'large'),
      admin.from('kb_sources').select('filename', { head: true, count: 'exact' }),
      admin.from('kb_audit_state').select('value, updated_at').eq('key', 'contradiction_offset').maybeSingle(),
      admin.from('kb_audit_state').select('value, updated_at').eq('key', 'last_crawl').maybeSingle(),
      admin.from('kb_audit_state').select('value, updated_at').eq('key', 'crawl_state').maybeSingle(),
      admin
        .from('kb_source_drift')
        .select('checked_at')
        .order('checked_at', { ascending: false })
        .limit(1),
      admin.from('kb_review_queue').select('id', { head: true, count: 'exact' }).eq('status', 'pending'),
    ]);

  const crawlStateVal = (crawlState.data?.value ?? null) as
    | { offset?: number; urls?: unknown[]; completed?: boolean }
    | null;
  const crawlInProgress = !!crawlStateVal && crawlStateVal.completed === false;

  return {
    kb: {
      source_count: sourceCount.count ?? 0,
      chunk_count: chunksCount.count ?? 0,
      last_kb_update: sourcesAgg.data?.[0]?.updated_at ?? null,
    },
    crawl: {
      // Heartbeat skrivs när schemalagd crawl slutförts. Innan dess: fall tillbaka
      // på senaste website-källans tidsstämpel.
      last_completed: crawlHeartbeat.data?.value ?? null,
      fallback_last_website_update: websiteAgg.data?.[0]?.updated_at ?? null,
      in_progress: crawlInProgress
        ? {
            done: crawlStateVal?.offset ?? 0,
            total: Array.isArray(crawlStateVal?.urls) ? crawlStateVal!.urls!.length : 0,
          }
        : null,
    },
    audit: {
      last_run: auditState.data?.updated_at ?? null,
      review_pending: reviewPending.count ?? 0,
      scheduled: false, // pg_cron-jobbet aktiveras manuellt; uppdatera om/när det körs
    },
    drift: {
      last_check: drift.data?.[0]?.checked_at ?? null,
    },
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export const config: Config = {
  path: '/api/system-status',
};
