# kb-audit · Motsägelsedetektion (v1)

Nattligt system som hittar par av chunks i `kb_chunks` som säger emot
varandra och lägger dem i en granskningskö (`kb_review_queue`) för manuell
granskning via fliken **Granskning** i intranetet.

## Arkitektur

```
pg_cron (03:15 UTC nattligt)
        │
        │  läser current offset från kb_audit_state
        ▼
pg_net.http_post  ───► /api/kb-audit-contradictions  (Netlify Function)
                              │
                              ├─► hämtar batch från kb_chunks
                              ├─► match_kb_chunks per chunk (0.75 ≤ sim ≤ 0.95)
                              ├─► parallella Claude-anrop (8 i taget, 26s budget)
                              ├─► insert i kb_review_queue (ON CONFLICT DO NOTHING)
                              └─► uppdaterar kb_audit_state (nästa offset)

UI (/granskning)  ───► läser kb_review_queue  ◄───  /api/review-action
                        (filtrera, granska)         (resolve/ignore/reopen)
```

## Manuell första körning (test innan pg_cron aktiveras)

Det här bör du göra INNAN du schemalägger pg_cron, för att:
- Bekräfta att Netlify-functionen fungerar med riktiga nycklar
- Få en snabb uppfattning om kostnad/tid per batch
- Fylla på några första ärenden att testa UI:t med

### 1. Sätt env var i Netlify

Slumpa en secret (ex. `openssl rand -hex 32`) och lägg till i Netlify:
- Site settings → Environment variables → Add variable
- Key: `CRON_SECRET`
- Value: `<din slumpade secret>`

Trigga ny deploy så functionen plockar upp den.

### 2. Kör mot produktion via curl

```bash
CRON_SECRET="<samma som Netlify>"

curl -sS -X POST https://elkretsen.netlify.app/api/kb-audit-contradictions \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"batch_size": 20, "offset": 0}' | python -m json.tool
```

Förväntad respons (efter ~20-26s):

```json
{
  "pairs_checked": 42,
  "contradictions_found": 3,
  "time_elapsed_ms": 21340,
  "batch_offset_next": 20,
  "completed": false,
  "chunks_processed": 20,
  "chunks_total": 1661
}
```

Om `completed: true` — då har vi processat hela `kb_chunks`. Vid första
körningen är detta extremt osannolikt med batch_size ≤ 100.

### 3. Aktivera schemaläggning (`pg_cron`)

Öppna `docs/kb-audit/pg_cron_schedule.sql`, ersätt `__SAMMA_SOM_NETLIFY__`
med värdet på `CRON_SECRET`, och kör hela filen i Supabase SQL Editor.

Verifiera:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'kb-audit-contradictions-nightly';
```

## Kostnadsuppskattning

Grovt räknat (Claude Sonnet 4 per 2026-01):
- Input: $3/M tokens, Output: $15/M tokens
- Genomsnittligt par ≈ 1 200 + 1 200 + prompt 300 = **~2 700 input-tokens**
- Svar ≈ 100 output-tokens

Per par: $0.0081 input + $0.0015 output ≈ **$0.0096 ≈ 0,10 kr**

Efter dedup:
- 1 661 chunks × upp till 5 kandidater = 8 305 possible pairs
- `least(a,b), greatest(a,b)`-constraint halverar = **~4 000 unika par**
- Första fulla audit: **4 000 × 0,10 kr ≈ 400 kr**
- Plus inbäddningssökningar (redan lagrade → noll extra cost)

Nattlig körning vid batch_size 100:
- ~100 chunks × 5 par = 500 par men många dedupe → ~150 nya par
- Hinner ~100-200 Claude-anrop innan 26s-timeout
- Varje natt: **0,80 kr ≈ ingen nämnvärd kostnad**

Full täckning över alla 1 661 chunks tar ~15-20 nätter. Efter det kör
systemet idempotent — nya eller ändrade chunks fångas i nästa varv
(offset resetar till 0 vid `completed: true`).

## Justera trösklarna

I `netlify/functions/kb-audit-contradictions.ts`:

```ts
const SIMILARITY_LOW = 0.75;   // minsta likhet för att anses kandidat
const SIMILARITY_HIGH = 0.95;  // max likhet (över detta = sannolikt dublett)
const MAX_CANDIDATES_PER_CHUNK = 5;
const MATCH_COUNT = 10;
```

**Sänk `SIMILARITY_LOW`** till 0.7 om för få motsägelser hittas (fler kandidater,
dyrare). **Höj** till 0.8 för att fokusera på tydligare överlapp.

**`SIMILARITY_HIGH`** filtrerar bort nästan-identiska chunks (som ofta bara
är duplicerade citat snarare än motsägelser). Lämna kring 0.95.

## Lägg till nya issue_type senare

`kb_review_queue.issue_type` är textfält (default `'contradiction'`). Lägg
till fler utan schema-ändring:

- `'duplicate'` — chunks med sim > 0.97 som inte är identiska ord-för-ord
- `'stale'` — URL-källor vars webbsida ändrats sen senaste crawl
- `'authority_conflict'` — när intern text säger emot en SFS-paragraf

Skapa separata Netlify-functions för varje, återanvänd samma
`kb_review_queue`-tabell + UI. Filter-segmenten i Granskning-sidan kan
utökas till att inkludera `issue_type` vid behov.

Unique-indexet hanterar redan flera issue-types per par (ingår som tredje
kolumn i constraint:en).

## Filer i detta system

| Fil | Syfte |
|---|---|
| Migration `kb_audit_review_queue` | Tabeller + RLS + count-RPC |
| Migration `enable_pg_net_and_pg_cron` | Extensions |
| `netlify/functions/kb-audit-contradictions.ts` | Huvudbatchen |
| `netlify/functions/review-action.ts` | resolve/ignore/reopen-endpoint |
| `src/pages/GranskningPage.tsx` | UI:t |
| `docs/kb-audit/pg_cron_schedule.sql` | Schemalagt nattjobb |
| `docs/kb-audit/README.md` | Du är här |

## Env vars som krävs

Netlify → Site settings → Environment variables:

| Variabel | Används av |
|---|---|
| `ANTHROPIC_API_KEY` | Claude-anropen |
| `SUPABASE_URL` | Båda functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Båda functions |
| `VITE_SUPABASE_ANON_KEY` | `review-action` (JWT-verifiering) |
| `CRON_SECRET` | Skyddar audit-endpointen |
