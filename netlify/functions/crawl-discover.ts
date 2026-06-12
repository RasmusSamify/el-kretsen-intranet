import type { Config } from '@netlify/functions';
import { parse } from 'node-html-parser';
import { requireAdmin } from './_shared/auth';

/**
 * Sajt-upptäckt för "Crawla sajt"-flödet. Tar en start-URL (domän eller
 * undersida) och returnerar en lista över sidor på samma host — UTAN att hämta
 * eller indexera dem. Frontend visar listan som en checklista där admin bockar
 * i/ur, och kör sedan bara ikryssade URL:er genom den befintliga
 * /api/ingest-url (en i taget, med progress). På så vis hålls basen kurerad:
 * människan bestämmer alltid vad som faktiskt hamnar i kunskapsbasen.
 *
 * Discovery är medvetet billig (sitemaps + ev. en sidas länkar) så den ryms
 * inom Netlifys ~26s-tak även för stora sajter. Den dyra biten — att hämta och
 * chunka varje sida — sker per URL via ingest-url.
 *
 * Auth: admin-JWT (samma som ingest-url).
 */

interface DiscoverRequest {
  url: string;
  scope?: string | null; // valfritt path-prefix, t.ex. "/vagledning-och-stod/producentansvar"
}

interface DiscoveredUrl {
  url: string;
  path: string;
}

interface DiscoverResponse {
  ok: true;
  origin: string;
  host: string;
  fromSitemap: boolean;
  total: number;
  urls: DiscoveredUrl[];
}

const MAX_URLS = 600; // tak på antal upptäckta sidor (skydd mot enorma sitemaps)
const MAX_SITEMAPS = 25; // tak på antal sitemap-filer vi hämtar (inkl. nästlade index)
const TIME_BUDGET_MS = 20_000;
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ElvisHubCrawler/1.0; +https://elkretsen.netlify.app)',
};

export default async (req: Request) => {
  const startedAt = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: DiscoverRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const rawUrl = (body.url ?? '').trim();
  let start: URL;
  try {
    start = new URL(rawUrl);
    if (!/^https?:$/.test(start.protocol)) throw new Error('Only http(s) URLs');
  } catch {
    return json({ error: 'Ogiltig URL. Måste börja med http:// eller https://' }, 400);
  }

  const origin = start.origin;
  const host = start.host;
  const scope = normaliseScope(body.scope);

  const found = new Map<string, DiscoveredUrl>(); // nyckel = ren URL utan fragment

  const addUrl = (u: string) => {
    if (found.size >= MAX_URLS) return;
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      return;
    }
    if (parsed.host !== host) return; // håll oss till samma sajt
    if (!/^https?:$/.test(parsed.protocol)) return;
    if (isNonHtml(parsed.pathname)) return;
    if (scope && !parsed.pathname.startsWith(scope)) return;
    parsed.hash = '';
    const key = parsed.toString();
    if (!found.has(key)) found.set(key, { url: key, path: parsed.pathname || '/' });
  };

  // 1. Samla sitemap-URL:er: robots.txt + vanliga standardplatser
  const sitemapQueue: string[] = [];
  const seenSitemaps = new Set<string>();
  const queueSitemap = (sm: string) => {
    if (seenSitemaps.has(sm) || seenSitemaps.size >= MAX_SITEMAPS) return;
    seenSitemaps.add(sm);
    sitemapQueue.push(sm);
  };

  for (const sm of await sitemapsFromRobots(origin)) queueSitemap(sm);
  for (const sm of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`]) {
    queueSitemap(sm);
  }

  // 2. Beta av sitemap-kön (nästlade index expanderas) inom tidsbudgeten
  let sawAnySitemap = false;
  while (sitemapQueue.length > 0 && Date.now() - startedAt < TIME_BUDGET_MS && found.size < MAX_URLS) {
    const sm = sitemapQueue.shift()!;
    const xml = await safeFetchText(sm);
    if (!xml) continue;
    sawAnySitemap = true;
    const locs = extractLocs(xml);
    for (const loc of locs) {
      if (/\.xml(\.gz)?($|\?)/i.test(loc)) {
        queueSitemap(loc); // nästlat sitemap-index
      } else {
        addUrl(loc);
      }
    }
  }

  // 3. Fallback om ingen sitemap gav träffar: skrapa länkar från startsidan (en nivå)
  let fromSitemap = found.size > 0;
  if (found.size === 0) {
    const html = await safeFetchText(start.toString());
    if (html) {
      const root = parse(html);
      for (const a of root.querySelectorAll('a')) {
        const href = a.getAttribute('href');
        if (!href) continue;
        try {
          addUrl(new URL(href, origin).toString());
        } catch {
          /* ogiltig href, hoppa */
        }
      }
    }
    // Ta alltid med startsidan själv om den passerar scope-filtret
    addUrl(start.toString());
    fromSitemap = false;
  }

  const urls = Array.from(found.values()).sort((a, b) => a.path.localeCompare(b.path, 'sv'));

  const payload: DiscoverResponse = {
    ok: true,
    origin,
    host,
    fromSitemap: fromSitemap && sawAnySitemap,
    total: urls.length,
    urls,
  };
  return json(payload, 200);
};

/** Normalisera scope till ett path-prefix som börjar med "/" (eller null). */
function normaliseScope(scope: string | null | undefined): string | null {
  const s = (scope ?? '').trim();
  if (!s) return null;
  // Tillåt att man klistrar in en hel URL som scope — plocka ut pathen.
  try {
    if (/^https?:\/\//i.test(s)) return new URL(s).pathname.replace(/\/$/, '') || '/';
  } catch {
    /* faller igenom */
  }
  return ('/' + s.replace(/^\/+/, '')).replace(/\/$/, '') || '/';
}

async function sitemapsFromRobots(origin: string): Promise<string[]> {
  const txt = await safeFetchText(`${origin}/robots.txt`);
  if (!txt) return [];
  const out: string[] = [];
  for (const line of txt.split('\n')) {
    const m = /^\s*sitemap:\s*(\S+)/i.exec(line);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const u = m[1].trim().replace(/&amp;/g, '&');
    if (u) out.push(u);
  }
  return out;
}

function isNonHtml(pathname: string): boolean {
  return /\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|css|js|json|ico|woff2?|ttf|mp4|mp3)$/i.test(
    pathname,
  );
}

async function safeFetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 8_000_000) return null; // skydd mot enorma sitemaps
    return new TextDecoder('utf-8').decode(buf);
  } catch {
    return null;
  }
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
  path: '/api/crawl-discover',
};
