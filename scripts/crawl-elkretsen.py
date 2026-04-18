"""
Crawlar el-kretsen.se via sitemap, hämtar alla svenska sidor,
extraherar text, chunkar, embeddar via Voyage och skriver till
kb_chunks. URL blir filename så de listas under "Källor" i UI:t.

Körs en gång för initial-population. För uppdateringar: kör om med
samma URL — befintliga chunks ersätts (upsert).
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse
from html.parser import HTMLParser
from pathlib import Path

# ---------- Load .env.local ----------
ENV_PATH = Path(r"C:\Users\rasmu\el-kretsen-intranet\.env.local")
for line in ENV_PATH.read_text(encoding='utf-8').splitlines():
    m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line)
    if m and not os.environ.get(m.group(1)):
        os.environ[m.group(1)] = m.group(2).strip('"\'')

SUPABASE_URL = os.environ['SUPABASE_URL']
SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
VOYAGE_KEY = os.environ['VOYAGE_API_KEY']

SITEMAPS = [
    'https://www.el-kretsen.se/post-sitemap1.xml',
    'https://www.el-kretsen.se/page-sitemap1.xml',
]

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200
BATCH_SIZE = 25
FETCH_DELAY = 0.8  # sek mellan page-fetches
MAX_PAGE_BYTES = 1_500_000

USER_AGENT = 'Mozilla/5.0 (compatible; ElvisHubIngester/1.0; +https://elkretsen.netlify.app)'


def http(method, url, headers=None, body=None, timeout=60):
    headers = headers or {}
    headers.setdefault('User-Agent', USER_AGENT)
    data = body if isinstance(body, bytes) else (body.encode('utf-8') if body else None)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(), resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers
    except Exception as e:
        return 0, str(e).encode('utf-8'), {}


# ---------- Step 1: Collect URLs from sitemaps ----------

urls = []
for sm in SITEMAPS:
    status, body, _ = http('GET', sm)
    if status != 200:
        print(f'! Sitemap {sm} svarade {status}')
        continue
    for m in re.finditer(r'<loc>([^<]+)</loc>', body.decode('utf-8')):
        urls.append(m.group(1).strip())

# Keep only Swedish URLs (skip ?lang=en duplicates) and normalise
swedish = []
seen = set()
for u in urls:
    if '?lang=en' in u:
        continue
    if u.endswith('.pdf') or u.endswith('.jpg') or u.endswith('.png'):
        continue
    if u in seen:
        continue
    seen.add(u)
    swedish.append(u)

print(f'Sitemap gav {len(urls)} URL:er totalt, {len(swedish)} svenska unika sidor att indexera.\n')

# ---------- HTML text extractor ----------

class TextExtractor(HTMLParser):
    BLOCK_TAGS = {'p', 'div', 'section', 'article', 'main', 'li', 'td', 'br', 'h1',
                  'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'ul', 'ol'}
    SKIP_TAGS = {'script', 'style', 'nav', 'footer', 'header', 'aside', 'form',
                 'iframe', 'noscript', 'svg'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.title = None
        self.skip_depth = 0
        self._in_title = False
        self._in_main = False
        self._main_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == 'title':
            self._in_title = True
            return
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return
        attr_map = dict(attrs)
        cls = attr_map.get('class', '') or ''
        role = attr_map.get('role', '') or ''
        if any(x in cls.lower() for x in ('cookie', 'navigation', 'menu', 'header', 'footer', 'sidebar')):
            self.skip_depth += 1
            return
        if tag in ('main', 'article'):
            self._in_main = True
            self._main_depth += 1
        if self._in_title:
            return
        if tag in self.BLOCK_TAGS:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == 'title':
            self._in_title = False
            return
        if tag in self.SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if tag in ('main', 'article') and self._main_depth > 0:
            self._main_depth -= 1
            if self._main_depth == 0:
                self._in_main = False

    def handle_data(self, data):
        if self.skip_depth > 0:
            return
        if self._in_title:
            if self.title is None:
                self.title = data.strip()
            return
        self.parts.append(data)

    def get_text(self):
        raw = ''.join(self.parts)
        lines = [re.sub(r'\s+', ' ', line).strip() for line in raw.split('\n')]
        return '\n'.join(line for line in lines if line)


def extract(html_bytes):
    html = html_bytes.decode('utf-8', errors='ignore')
    p = TextExtractor()
    try:
        p.feed(html)
        p.close()
    except Exception:
        pass
    return p.title, p.get_text()


# ---------- Chunking ----------

def chunk(text, filename):
    out = []
    buf = ''
    idx = 0

    def push(t):
        nonlocal idx
        out.append({'filename': filename, 'chunk_index': idx, 'text': t.strip()})
        idx += 1

    for para in re.split(r'\n\s*\n', text):
        p = para.strip()
        if not p:
            continue
        if len(buf) + len(p) + 2 <= CHUNK_SIZE:
            buf = (buf + '\n\n' + p) if buf else p
        else:
            if buf:
                push(buf)
                tail = buf[-CHUNK_OVERLAP:]
                buf = tail + '\n\n' + p
            else:
                for i in range(0, len(p), CHUNK_SIZE - CHUNK_OVERLAP):
                    push(p[i:i + CHUNK_SIZE])
                buf = ''
    if buf:
        push(buf)
    return out


def embed(texts):
    status, resp, _ = http(
        'POST',
        'https://api.voyageai.com/v1/embeddings',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {VOYAGE_KEY}',
        },
        body=json.dumps({'model': 'voyage-3', 'input': texts, 'input_type': 'document'}),
    )
    if status != 200:
        raise RuntimeError(f'Voyage {status}: {resp.decode()}')
    return [d['embedding'] for d in json.loads(resp)['data']]


def canonical_filename(url):
    parsed = urllib.parse.urlparse(url)
    path = parsed.path or '/'
    return f'{parsed.netloc}{path}' + ('?' + parsed.query if parsed.query else '')


def upsert_chunks(filename, rows):
    # Delete existing chunks for this filename first
    del_url = f"{SUPABASE_URL}/rest/v1/kb_chunks?filename=eq.{urllib.parse.quote(filename)}"
    http('DELETE', del_url, headers={'Authorization': f'Bearer {SERVICE_KEY}', 'apikey': SERVICE_KEY})
    ins_url = f"{SUPABASE_URL}/rest/v1/kb_chunks"
    status, resp, _ = http(
        'POST',
        ins_url,
        headers={
            'Authorization': f'Bearer {SERVICE_KEY}',
            'apikey': SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body=json.dumps(rows),
    )
    if status not in (200, 201):
        raise RuntimeError(f'Insert {status}: {resp.decode()[:200]}')


# ---------- Main loop ----------

stats = {'ok': 0, 'skipped': 0, 'failed': 0, 'chunks': 0, 'tokens': 0}

for i, url in enumerate(swedish, 1):
    filename = canonical_filename(url)
    print(f'[{i}/{len(swedish)}] {url}')
    status, body, headers = http('GET', url, timeout=30)
    if status != 200:
        print(f'    ! HTTP {status}')
        stats['failed'] += 1
        continue
    if len(body) > MAX_PAGE_BYTES:
        print(f'    ! för stor ({len(body)} bytes) — skippar')
        stats['skipped'] += 1
        continue
    title, text = extract(body)
    if len(text) < 200:
        print(f'    - för lite text ({len(text)} tecken) — skippar')
        stats['skipped'] += 1
        continue
    # Prepend page title as semantic context for each chunk
    prefix = f'{title}\n\n' if title else ''
    chunks = chunk(prefix + text, filename)
    if not chunks:
        stats['skipped'] += 1
        continue
    try:
        # embed in batches
        rows = []
        for b_start in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[b_start:b_start + BATCH_SIZE]
            embs = embed([c['text'] for c in batch])
            for c, e in zip(batch, embs):
                rows.append({
                    'filename': c['filename'],
                    'chunk_index': c['chunk_index'],
                    'text': c['text'],
                    'token_count': round(len(c['text']) / 4),
                    'embedding': e,
                })
        upsert_chunks(filename, rows)
        stats['ok'] += 1
        stats['chunks'] += len(rows)
        print(f'    OK — {title[:60] if title else "(ingen titel)"} · {len(rows)} chunks')
    except Exception as e:
        print(f'    ! FEL: {e}')
        stats['failed'] += 1

    time.sleep(FETCH_DELAY)

print('\n' + '=' * 60)
print(f'Klart! {stats["ok"]} sidor indexerade, {stats["skipped"]} skippade, {stats["failed"]} failade.')
print(f'Totalt {stats["chunks"]} nya chunks i kb_chunks.')
