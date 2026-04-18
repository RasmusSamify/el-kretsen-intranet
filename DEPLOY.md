# ELvis Hub — Deployment-guide

Status: React-rewrite klar. AI-analys använder embeddings-baserad RAG med tvingade citations + temperature 0 för deterministiska svar.

**AI-stack:** Claude Sonnet 4 (generering) + Voyage AI `voyage-3` (embeddings, juridik-optimerad) + pgvector (sökning). Inget OpenAI/ChatGPT används.

## Steg för att driftsätta till produktion

### 1. Skaffa API-nycklar

**Voyage AI-nyckel** (embeddings — Anthropics officiella partner):
1. Gå till https://dash.voyageai.com/api-keys
2. Skapa konto (gratis) och generera en API-nyckel
3. Free tier: **200 miljoner tokens** — räcker för El-kretsens kunskapsbas många gånger om

**Supabase Service Role-nyckel** (för att Netlify-functions ska kunna söka i `kb_chunks`):
1. Gå till https://supabase.com/dashboard/project/jnwatbnkdzuyhqmcerej/settings/api
2. Kopiera `service_role` secret (börjar med `eyJ...`)
3. ⚠️ Dela aldrig denna — den har full skrivåtkomst

**Anthropic-nyckel** — redan i bruk (`ANTHROPIC_API_KEY` i Netlify).

### 2. Lägg till i `.env.local` (lokal utveckling)

Lägg till i `C:\Users\rasmu\el-kretsen-intranet\.env.local`:

```
VOYAGE_API_KEY=pa-...
SUPABASE_URL=https://jnwatbnkdzuyhqmcerej.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=<din-befintliga-nyckel>
```

### 3. Embedda kunskapsbasen (engångsjobb)

```bash
cd C:\Users\rasmu\el-kretsen-intranet
npm run backfill
```

Skriptet:
- Läser alla `.txt`-filer från Supabase-bucket `Linneas AI-losning`
- Chunkar till ~1200 tecken med 200 overlap
- Skapar embeddings via Voyage AI `voyage-3` (1024 dim, juridik-optimerad)
- Skriver till tabellen `kb_chunks`

Kostar **0 kr** inom free tier.

### 4. Testa lokalt

```bash
npm run dev
```

Öppna http://localhost:5173 och logga in med El-kretsen-konto.

Smoketest:
- ✅ Ställ fråga om producentansvar → svar med klickbara citations som öppnar exakt källtext
- ✅ Ställ samma fråga två gånger → identiska svar (temperature 0)
- ✅ Ställ fråga utanför domän → "Jag hittar inte svaret i kunskapsbanken. Kontakta ansvarig sakkunnig."

### 5. Netlify-deploy

I Netlify dashboard (Site settings → Environment variables) lägg till:

```
ANTHROPIC_API_KEY=<befintlig>
VOYAGE_API_KEY=<ny — samma som lokalt>
SUPABASE_URL=https://jnwatbnkdzuyhqmcerej.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<ny — samma som lokalt>
VITE_SUPABASE_URL=https://jnwatbnkdzuyhqmcerej.supabase.co
VITE_SUPABASE_ANON_KEY=<befintlig anon-key>
```

Pusha till GitHub → Netlify bygger automatiskt med `npm run build` (Vite) och deployar `dist/` + functions.

## Arkitektur

```
Browser
  │
  ├─→ Supabase Auth (login)
  ├─→ Supabase Storage (dokumentbank + quiz)
  ├─→ Supabase Postgres (kb_chunks, ai_questions, kretskampen_scores)
  │
  └─→ Netlify Functions
       ├─→ /api/ai-search    → Voyage embed + pgvector match + Claude (grounded, temp 0)
       ├─→ /api/embed-kb     → Voyage embeddings
       └─→ /api/claude-proxy → legacy passthrough
```

## Kvalitetssäkring av AI-konsistens

**Temperature 0** — Claude returnerar exakt samma svar för samma input.

**Strikt system-prompt** — AI:n får bara svara baserat på `<kunskapsbas>`-taggen. Alla påståenden ska ha inline-citationer i formatet `[källa: filnamn, stycke N]`.

**Högkvalitativa multilingvala embeddings** — `voyage-3` (Anthropics officiella embedding-partner, 1024 dim, 32K context) ger bättre semantisk matchning på svenska lagtexter än OpenAI:s modeller. Free tier: 200M tokens/månad. pgvector HNSW-index för snabba queries.

**Match-parametrar** — threshold 0.3, top-8 chunks.

**No-match fallback** — När inga chunks matchar over threshold returnerar systemet: "Jag hittar inte svaret i kunskapsbanken. Kontakta ansvarig sakkunnig."

## Nästa steg (post-release)

- Tema-switcher (4 färger) — redan förberett i tokens.css
- Dokumentbank-sidebar — kopiera från legacy/index.html
- Zapier-chatbot-iframe (om relevant)
- Automatisk re-embedding vid nya KB-uppladdningar (Storage Webhook)
- Streaming-svar (SSE från /api/ai-search)
