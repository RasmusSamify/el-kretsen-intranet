"""
Enklare crawler som använder vår production-endpoint /api/ingest-url
för varje sitemap-URL. Production-funktionen använder node-html-parser
som är beprövat — ger bättre text-extraktion än vår lokala.
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse
from pathlib import Path

ENV_PATH = Path(r"C:\Users\rasmu\el-kretsen-intranet\.env.local")
for line in ENV_PATH.read_text(encoding='utf-8').splitlines():
    m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line)
    if m and not os.environ.get(m.group(1)):
        os.environ[m.group(1)] = m.group(2).strip('"\'')

INGEST_URL = 'https://elkretsen.netlify.app/api/ingest-url'
SITEMAPS = [
    'https://www.el-kretsen.se/post-sitemap1.xml',
    'https://www.el-kretsen.se/page-sitemap1.xml',
]
FETCH_DELAY = 1.5  # sek mellan ingest-anrop


def http(method, url, headers=None, body=None, timeout=120):
    headers = headers or {}
    headers.setdefault('User-Agent', 'ElvisHubCrawler/1.0')
    data = body if isinstance(body, bytes) else (body.encode('utf-8') if body else None)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return 0, str(e).encode('utf-8')


urls = []
for sm in SITEMAPS:
    status, body = http('GET', sm)
    if status != 200:
        print(f'! sitemap {sm} svarade {status}')
        continue
    for m in re.finditer(r'<loc>([^<]+)</loc>', body.decode('utf-8')):
        u = m.group(1).strip()
        if '?lang=en' in u:
            continue
        if u.endswith(('.pdf', '.jpg', '.png', '.xml')):
            continue
        if u not in urls:
            urls.append(u)

print(f'{len(urls)} svenska URL:er att indexera via production-API.\n')

stats = {'ok': 0, 'skipped': 0, 'failed': 0, 'total_chunks': 0}
for i, url in enumerate(urls, 1):
    payload = json.dumps({'url': url})
    status, resp = http(
        'POST',
        INGEST_URL,
        headers={'Content-Type': 'application/json'},
        body=payload,
    )
    try:
        data = json.loads(resp)
    except Exception:
        data = {'error': resp.decode('utf-8', errors='ignore')[:200]}
    if status == 200 and data.get('ok'):
        stats['ok'] += 1
        stats['total_chunks'] += data.get('chunks', 0)
        print(f'[{i}/{len(urls)}] OK — {data.get("title","(ingen titel)")[:60]} · {data.get("chunks")} chunks')
    elif status == 422:
        stats['skipped'] += 1
        print(f'[{i}/{len(urls)}] SKIP — {url} (för lite text)')
    else:
        stats['failed'] += 1
        print(f'[{i}/{len(urls)}] FAIL {status} — {data.get("error","?")[:120]}')
    time.sleep(FETCH_DELAY)

print('\n' + '=' * 60)
print(f'Klart! {stats["ok"]} ok, {stats["skipped"]} skippade, {stats["failed"]} failade.')
print(f'Totalt {stats["total_chunks"]} nya chunks i kb_chunks.')
