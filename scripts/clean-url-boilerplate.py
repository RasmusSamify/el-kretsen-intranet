"""
Ta bort boilerplate (nav, SVG DOCTYPE, pagination, footer, card-teasers)
från URL-chunks.

Metod:
1. Hämta alla chunks där source_category='website'.
2. Gruppera per domän (del före första "/" i filename).
3. För varje domän: räkna hur många DISTINKTA pages varje rad förekommer på.
4. Rad markeras som boilerplate om:
   - Den förekommer på ≥ MIN_PAGES pages, OCH
   - Längd ≥ MIN_BOILERPLATE_LEN (för att inte ta bort naturliga rubriker som
     "Avgifter" / "Dokument" som kan vara giltigt innehåll på egna sidor).
5. Rena varje chunk (ta bort boilerplate-rader).
6. Ta bort chunks som blir < MIN_CHUNK_LEN (oanvändbara).
7. Re-embedda behållna chunks med context prefix.

Kör:
  python scripts/clean-url-boilerplate.py           # dry-run, visar förslag
  python scripts/clean-url-boilerplate.py --apply   # gör faktisk uppdatering
"""

import json
import os
import re
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ENV_PATH = Path(r"C:\Users\rasmu\el-kretsen-intranet\.env.local")
for line in ENV_PATH.read_text(encoding='utf-8').splitlines():
    m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line)
    if m and not os.environ.get(m.group(1)):
        os.environ[m.group(1)] = m.group(2).strip('"\'')

SUPABASE_URL = os.environ['SUPABASE_URL']
SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
VOYAGE_KEY = os.environ['VOYAGE_API_KEY']

SAFE_PAGES = 10   # strip automatically — troligen pure navigation/markup
REVIEW_PAGES = 5  # visa bara för granskning — kan vara news-teasers
MIN_BOILERPLATE_LEN = 15
MIN_CHUNK_LEN = 150
EMBED_BATCH = 50

ALWAYS_STRIP = [
    re.compile(r'^<!DOCTYPE svg PUBLIC .+?svg11\.dtd">$', re.IGNORECASE),
    re.compile(r'^Skriv ut<\?xml version=.+?\?>$', re.IGNORECASE),
    re.compile(r'^Skriv ut$', re.IGNORECASE),
    re.compile(r'^<\?xml version=.+?\?>$', re.IGNORECASE),
]


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


def fetch_website_chunks():
    chunks = []
    offset = 0
    page_size = 1000
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/kb_chunks"
            f"?select=id,filename,chunk_index,text"
            f"&source_category=eq.website"
            f"&order=id.asc&offset={offset}&limit={page_size}"
        )
        status, body = http('GET', url, headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
        })
        if status != 200:
            raise RuntimeError(f'Fetch chunks: {status} {body.decode()[:200]}')
        page = json.loads(body)
        if not page:
            break
        chunks.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return chunks


def domain_of(filename: str) -> str:
    return filename.split('/', 1)[0]


def always_strip(line: str) -> bool:
    return any(p.match(line) for p in ALWAYS_STRIP)


def detect_boilerplate(chunks):
    # For each domain: map line -> set of filenames where it appears
    by_domain = defaultdict(lambda: defaultdict(set))
    for c in chunks:
        domain = domain_of(c['filename'])
        for raw_line in c['text'].split('\n'):
            line = raw_line.strip()
            if not line:
                continue
            by_domain[domain][line].add(c['filename'])

    boilerplate = defaultdict(set)          # domain -> SAFE lines (applied)
    review = defaultdict(list)              # domain -> [(line, page_count)] for review
    for domain, lines in by_domain.items():
        for line, pages in lines.items():
            if always_strip(line):
                boilerplate[domain].add(line)
                continue
            if len(line) < MIN_BOILERPLATE_LEN:
                continue
            n = len(pages)
            if n >= SAFE_PAGES:
                boilerplate[domain].add(line)
            elif n >= REVIEW_PAGES:
                review[domain].append((line, n))
    return boilerplate, review


def clean_chunk(text: str, boilerplate_lines: set) -> str:
    kept = []
    for raw in text.split('\n'):
        stripped = raw.strip()
        if not stripped:
            kept.append(raw)
            continue
        if stripped in boilerplate_lines or always_strip(stripped):
            continue
        kept.append(raw)
    # Collapse triple+ newlines introduced by removed lines
    cleaned = '\n'.join(kept)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned).strip()
    return cleaned


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
    return [d['embedding'] for d in json.loads(resp)['data']]


def update_chunk(chunk_id: str, text: str, embedding: list, quality_score: int):
    body = json.dumps({
        'text': text,
        'embedding': embedding,
        'token_count': round(len(text) / 4),
        'quality_score': quality_score,
    })
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


def delete_chunks(chunk_ids):
    if not chunk_ids:
        return
    filter_list = ','.join(chunk_ids)
    status, resp = http(
        'DELETE',
        f'{SUPABASE_URL}/rest/v1/kb_chunks?id=in.({filter_list})',
        headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
            'Prefer': 'return=minimal',
        },
    )
    if status not in (200, 204):
        raise RuntimeError(f'Delete: {status} {resp.decode()[:200]}')


def quality_score(text: str) -> int:
    """Enkelt score: längd, alphanumeric ratio, antal meningar.

    Formel ger ~50 för tunt innehåll, 90+ för ren kroppsdel text.
    """
    if not text:
        return 0
    length = len(text)
    alnum = sum(1 for ch in text if ch.isalnum() or ch.isspace())
    alnum_ratio = alnum / length
    sentences = max(1, len(re.findall(r'[.!?]\s', text)))
    len_score = min(100, length // 12)
    ratio_score = int(alnum_ratio * 100)
    sent_score = min(100, sentences * 20)
    return int(0.5 * len_score + 0.3 * ratio_score + 0.2 * sent_score)


def main(apply_changes: bool):
    print(f'{"APPLY" if apply_changes else "DRY-RUN"} mode')
    print('Hämtar website-chunks...')
    chunks = fetch_website_chunks()
    print(f'{len(chunks)} chunks')

    boilerplate, review = detect_boilerplate(chunks)
    for domain, lines in boilerplate.items():
        print(f'\n[{domain}] SAFE ({SAFE_PAGES}+ pages) - {len(lines)} stycken:')
        for line in sorted(lines, key=lambda l: -len(l))[:15]:
            truncated = (line[:90] + '...') if len(line) > 90 else line
            print(f'  - {truncated}')

    for domain, items in review.items():
        print(f'\n[{domain}] REVIEW ({REVIEW_PAGES}-{SAFE_PAGES - 1} pages) - {len(items)} stycken, ej auto-raderade:')
        for line, n in sorted(items, key=lambda x: -x[1])[:10]:
            truncated = (line[:85] + '...') if len(line) > 85 else line
            print(f'  [{n}p] {truncated}')

    # Compute diffs
    to_update = []       # (id, new_text, chunk_index, filename)
    to_delete = []
    unchanged = 0
    orig_total_len = 0
    new_total_len = 0

    for c in chunks:
        domain = domain_of(c['filename'])
        cleaned = clean_chunk(c['text'], boilerplate.get(domain, set()))
        orig_total_len += len(c['text'])
        new_total_len += len(cleaned)
        if cleaned == c['text']:
            unchanged += 1
            continue
        if len(cleaned) < MIN_CHUNK_LEN:
            to_delete.append(c['id'])
        else:
            to_update.append((c['id'], cleaned, c['chunk_index'], c['filename']))

    print(f'\n=== Sammanfattning ===')
    print(f'Oförändrade:       {unchanged}')
    print(f'Att uppdatera:     {len(to_update)}')
    print(f'Att ta bort:       {len(to_delete)} (blir < {MIN_CHUNK_LEN} tecken efter städning)')
    print(f'Total textmängd:   {orig_total_len:,} -> {new_total_len:,} tecken '
          f'({100 * new_total_len // max(1, orig_total_len)}% kvar)')

    if not apply_changes:
        print('\nKör med --apply för att verkligen göra ändringarna.')
        return

    print('\nRe-embeddar uppdaterade chunks...')
    start = time.time()
    for i in range(0, len(to_update), EMBED_BATCH):
        batch = to_update[i:i + EMBED_BATCH]
        inputs = [embedding_input(fn, idx, text) for (_, text, idx, fn) in batch]
        try:
            embeddings = embed_batch(inputs)
        except Exception as e:
            print(f'  ! Batch {i} failed: {e}')
            continue
        for (cid, text, _idx, _fn), emb in zip(batch, embeddings):
            try:
                update_chunk(cid, text, emb, quality_score(text))
            except Exception as e:
                print(f'  ! Update {cid}: {e}')
        done = i + len(batch)
        elapsed = time.time() - start
        rate = done / max(1e-6, elapsed)
        eta = (len(to_update) - done) / max(1e-6, rate)
        print(f'  {done}/{len(to_update)} · {rate:.0f}/s · ETA {eta:.0f}s')

    print(f'\nTar bort {len(to_delete)} chunks som blev för korta...')
    # Delete in batches of 100 to keep URLs short
    for i in range(0, len(to_delete), 100):
        delete_chunks(to_delete[i:i + 100])

    print(f'\nKlart på {time.time() - start:.0f}s.')


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    main(apply)
