"""
Kör audit-loopen mot Netlify-funktionen tills den är klar eller timar ut.

Varje iteration startar ca 22 sekunder. Netlify har 26s cap per anrop och
en funktions-timeout för hela processen på upp till ~60-70 min under load,
men vi loopas externt så varje batch är ett nytt HTTP-anrop.

Kör:
  python scripts/run-audit-loop.py
"""

import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

ENDPOINT = 'https://elkretsen.netlify.app/api/kb-audit-contradictions'
BATCH_SIZE = 15
MAX_MINUTES = 60

# Läs CRON_SECRET från .env.local (samma fil som andra scripts).
ENV_PATH = Path(r"C:\Users\rasmu\el-kretsen-intranet\.env.local")
if ENV_PATH.exists():
    for line in ENV_PATH.read_text(encoding='utf-8').splitlines():
        m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line)
        if m and not os.environ.get(m.group(1)):
            os.environ[m.group(1)] = m.group(2).strip('"\'')

CRON_SECRET = os.environ.get('CRON_SECRET')
if not CRON_SECRET:
    print('ERROR: CRON_SECRET saknas i env eller .env.local')
    sys.exit(1)


def call_once(offset):
    body = json.dumps({'batch_size': BATCH_SIZE, 'offset': offset}).encode('utf-8')
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'x-cron-secret': CRON_SECRET,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return -1, str(e).encode('utf-8')


def main():
    offset = 0
    total_pairs = 0
    total_contradictions = 0
    start = time.time()
    iteration = 0

    print(f'=== audit loop start {time.strftime("%H:%M:%S")} ===')

    while True:
        if (time.time() - start) > MAX_MINUTES * 60:
            print(f'MAX_MINUTES ({MAX_MINUTES}m) reached, stopping')
            break

        iteration += 1
        status, raw = call_once(offset)

        if status != 200:
            print(f'[{iteration}] PARSE FAILED (status {status})')
            print(f'raw(200): {raw.decode(errors="replace")[:200]}')
            break

        try:
            data = json.loads(raw)
        except Exception as e:
            print(f'[{iteration}] json-parse error: {e}; raw: {raw.decode(errors="replace")[:200]}')
            break

        pairs = data.get('pairs_checked', 0)
        cont = data.get('contradictions_found', 0)
        next_offset = data.get('batch_offset_next', offset)
        total_chunks = data.get('chunks_total', 0)
        chunks_proc = data.get('chunks_processed', 0)
        elapsed = data.get('time_elapsed_ms', 0)
        completed = data.get('completed', False)

        total_pairs += pairs
        total_contradictions += cont

        print(
            f'[{iteration}] offset {offset}->{next_offset}/{total_chunks} '
            f'chunks={chunks_proc} pairs={pairs} cont={cont} t={elapsed}ms'
        )

        if completed:
            print('COMPLETED (full pass through kb_chunks)')
            break

        offset = next_offset

    duration = int(time.time() - start)
    print(f'\nDuration: {duration}s  Iterations: {iteration}')
    print(f'Pairs: {total_pairs}  Contradictions: {total_contradictions}')


if __name__ == '__main__':
    main()
