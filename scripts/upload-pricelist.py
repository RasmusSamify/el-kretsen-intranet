"""
Laddar upp den nya Prislista_2026_RAG.txt till Supabase storage-bucket,
tar bort den gamla Produktlista-filen, embeddar den nya via Voyage,
och skriver chunks till kb_chunks.

Alla anrop använder .env.local — inga secrets hårdkodade.
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse
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

BUCKET = 'Linneas AI-losning'
SRC_FILE = Path(r"C:\Users\rasmu\Desktop\Samify\Elkretsen\El-kretsen Bot\Prislista_2026_RAG.txt")
REMOTE_NAME = 'Prislista_2026_RAG.txt'
OLD_REMOTE_NAME = 'Produktlista_Zapier_2026_korrigerad.txt'

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200
BATCH_SIZE = 25

# ---------- Helpers ----------

def http(method, url, headers=None, body=None):
    headers = headers or {}
    data = body if isinstance(body, bytes) else (body.encode('utf-8') if body else None)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def chunk_text(text, filename):
    # Split primarily on "### Kod" so each chunk contains whole codes
    # whenever possible; fall back to paragraph splitting for long tails.
    parts = re.split(r'(?=^### Kod )', text, flags=re.MULTILINE)
    chunks = []
    buffer = ''
    idx = 0

    def push(t):
        nonlocal idx
        chunks.append({'filename': filename, 'chunk_index': idx, 'text': t.strip()})
        idx += 1

    for part in parts:
        p = part.rstrip()
        if not p:
            continue
        # If part alone is huge, hard-split it
        if len(p) > CHUNK_SIZE:
            if buffer:
                push(buffer)
                buffer = ''
            for i in range(0, len(p), CHUNK_SIZE - CHUNK_OVERLAP):
                end = min(i + CHUNK_SIZE, len(p))
                push(p[i:end])
                if end == len(p):
                    break
            continue
        if len(buffer) + len(p) + 2 <= CHUNK_SIZE:
            buffer = f'{buffer}\n\n{p}' if buffer else p
        else:
            push(buffer)
            buffer = p
    if buffer:
        push(buffer)
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
        raise RuntimeError(f'Voyage {status}: {resp.decode()}')
    data = json.loads(resp)
    return [d['embedding'] for d in data['data']]


# ---------- 1. Upload file to storage bucket ----------

print(f'1. Laddar upp {SRC_FILE.name} till bucket "{BUCKET}"…')
file_bytes = SRC_FILE.read_bytes()
upload_url = f"{SUPABASE_URL}/storage/v1/object/{urllib.parse.quote(BUCKET)}/{urllib.parse.quote(REMOTE_NAME)}"
status, resp = http(
    'POST',
    upload_url,
    headers={
        'Authorization': f'Bearer {SERVICE_KEY}',
        'apikey': SERVICE_KEY,
        'Content-Type': 'text/plain; charset=utf-8',
        'x-upsert': 'true',
    },
    body=file_bytes,
)
if status not in (200, 201):
    # Some Supabase versions require PUT to overwrite
    status, resp = http(
        'PUT',
        upload_url,
        headers={
            'Authorization': f'Bearer {SERVICE_KEY}',
            'apikey': SERVICE_KEY,
            'Content-Type': 'text/plain; charset=utf-8',
        },
        body=file_bytes,
    )
if status not in (200, 201):
    print(f'  ! Upload svarade {status}: {resp.decode()[:200]}')
else:
    print(f'  OK ({len(file_bytes)} bytes)')

# ---------- 2. Remove old product list from kb_chunks ----------

print(f'2. Rensar gamla chunks i kb_chunks för "{OLD_REMOTE_NAME}"…')
delete_url = f"{SUPABASE_URL}/rest/v1/kb_chunks?filename=eq.{urllib.parse.quote(OLD_REMOTE_NAME)}"
status, resp = http(
    'DELETE',
    delete_url,
    headers={
        'Authorization': f'Bearer {SERVICE_KEY}',
        'apikey': SERVICE_KEY,
        'Prefer': 'return=representation',
    },
)
print(f'  Status {status} — {len(json.loads(resp)) if status == 200 else "?"} rader borttagna')

# Also clear any previous version of the new file
print(f'3. Rensar eventuella tidigare chunks för "{REMOTE_NAME}"…')
delete_url = f"{SUPABASE_URL}/rest/v1/kb_chunks?filename=eq.{urllib.parse.quote(REMOTE_NAME)}"
status, resp = http(
    'DELETE',
    delete_url,
    headers={
        'Authorization': f'Bearer {SERVICE_KEY}',
        'apikey': SERVICE_KEY,
        'Prefer': 'return=representation',
    },
)
print(f'  Status {status} — {len(json.loads(resp)) if status == 200 else "?"} rader borttagna')

# ---------- 3. Chunk & embed ----------

text = SRC_FILE.read_text(encoding='utf-8')
chunks = chunk_text(text, REMOTE_NAME)
print(f'4. Chunkar filen: {len(chunks)} chunks á max {CHUNK_SIZE} tecken')

# ---------- 4. Embed batches and insert ----------

print(f'5. Embeddar och infogar (batch_size={BATCH_SIZE})…')
inserted = 0
for i in range(0, len(chunks), BATCH_SIZE):
    batch = chunks[i:i + BATCH_SIZE]
    embeddings = embed_batch([c['text'] for c in batch])
    rows = []
    for c, e in zip(batch, embeddings):
        rows.append({
            'filename': c['filename'],
            'chunk_index': c['chunk_index'],
            'text': c['text'],
            'token_count': round(len(c['text']) / 4),
            'embedding': e,
        })
    insert_url = f"{SUPABASE_URL}/rest/v1/kb_chunks"
    status, resp = http(
        'POST',
        insert_url,
        headers={
            'Authorization': f'Bearer {SERVICE_KEY}',
            'apikey': SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body=json.dumps(rows),
    )
    if status not in (200, 201):
        print(f'  ! Insert fel vid batch {i // BATCH_SIZE}: {status} {resp.decode()[:300]}')
        break
    inserted += len(rows)
    print(f'   {inserted}/{len(chunks)} infogade')

print(f'\nKlart! {inserted} chunks embeddade för {REMOTE_NAME}.')
