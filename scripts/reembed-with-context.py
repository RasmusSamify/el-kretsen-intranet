"""
Re-embedda alla chunks i kb_chunks med contextualized prefix.

Detta är en ENGÅNGSOPERATION när man rullar ut v1.3.0 (contextualized chunks).
Gamla embeddings genererades utan kontext-prefix; nya embeddings med prefixet
"{dokumentnamn} · stycke N: ..." ger bättre retrieval på dokument-överlappande
frågor.

Kostnad: ~1.3M tokens via Voyage voyage-3 (gratis inom 200M free tier).
Tid: ~5-10 minuter för 1 661 chunks.

Kör:
  python scripts/reembed-with-context.py
"""

import json
import os
import re
import time
import urllib.request
from pathlib import Path

ENV_PATH = Path(r"C:\Users\rasmu\el-kretsen-intranet\.env.local")
for line in ENV_PATH.read_text(encoding='utf-8').splitlines():
    m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line)
    if m and not os.environ.get(m.group(1)):
        os.environ[m.group(1)] = m.group(2).strip('"\'')

SUPABASE_URL = os.environ['SUPABASE_URL']
SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
VOYAGE_KEY = os.environ['VOYAGE_API_KEY']

BATCH_SIZE = 50


def http(method, url, headers=None, body=None, timeout=60):
    headers = headers or {}
    data = body if isinstance(body, bytes) else (body.encode('utf-8') if body else None)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def context_prefix(filename: str, chunk_index: int) -> str:
    base = re.sub(r'\.[^/.]+$', '', filename)
    base = re.sub(r'[_-]+', ' ', base).strip()
    clean = re.sub(r'^www\.', '', base)
    return f'{clean} · stycke {chunk_index + 1}'


def embedding_input(filename: str, chunk_index: int, text: str) -> str:
    return f'{context_prefix(filename, chunk_index)}\n\n{text}'


# Hämta alla chunks via page-paginerad REST
def fetch_all_chunks():
    chunks = []
    offset = 0
    page_size = 1000
    while True:
        url = (
            f'{SUPABASE_URL}/rest/v1/kb_chunks'
            f'?select=id,filename,chunk_index,text'
            f'&order=id.asc'
            f'&offset={offset}&limit={page_size}'
        )
        status, body = http('GET', url, headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
        })
        if status != 200:
            raise RuntimeError(f'Fetch chunks failed: {status} {body.decode()[:200]}')
        page = json.loads(body)
        if not page:
            break
        chunks.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return chunks


def embed_batch(texts):
    body = json.dumps({
        'model': 'voyage-3',
        'input': texts,
        'input_type': 'document',
    })
    status, resp = http(
        'POST',
        'https://api.voyageai.com/v1/embeddings',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {VOYAGE_KEY}',
        },
        body=body,
    )
    if status != 200:
        raise RuntimeError(f'Voyage {status}: {resp.decode()[:200]}')
    return json.loads(resp)['data']


def update_embedding(chunk_id: str, embedding: list):
    body = json.dumps({'embedding': embedding})
    status, resp = http(
        'PATCH',
        f'{SUPABASE_URL}/rest/v1/kb_chunks?id=eq.{chunk_id}',
        headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body=body,
    )
    if status not in (200, 204):
        raise RuntimeError(f'Update {chunk_id}: {status} {resp.decode()[:200]}')


def main():
    print('Hämtar alla chunks...')
    chunks = fetch_all_chunks()
    total = len(chunks)
    print(f'{total} chunks att re-embedda')

    start = time.time()
    processed = 0
    for i in range(0, total, BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        inputs = [
            embedding_input(c['filename'], c['chunk_index'], c['text'])
            for c in batch
        ]
        try:
            embeddings = embed_batch(inputs)
        except Exception as e:
            print(f'  ! Batch {i}-{i + len(batch)} failed: {e}')
            continue

        for c, emb in zip(batch, embeddings):
            try:
                update_embedding(c['id'], emb['embedding'])
            except Exception as e:
                print(f'  ! Update {c["id"]} failed: {e}')

        processed += len(batch)
        elapsed = time.time() - start
        rate = processed / elapsed if elapsed > 0 else 0
        eta = (total - processed) / rate if rate > 0 else 0
        print(
            f'  {processed}/{total} ({100 * processed // total}%) '
            f'· {rate:.0f} chunks/s · ETA {eta:.0f}s'
        )

    print(f'\nKlart på {time.time() - start:.0f}s. {processed} chunks re-embeddade.')


if __name__ == '__main__':
    main()
