# El-kretsen Intranät

Intranät-applikation byggd som en statisk HTML/JS-app deployad på Netlify.

## Filstruktur

```
elk-intranet/
├── index.html                  # App-skal med navigation och tabbar
├── css/
│   └── styles.css              # Alla stilar + teman
├── js/
│   ├── config.js               # Supabase-credentials och konstanter
│   ├── theme.js                # Temabyte (havet/skog/citroner/universum)
│   ├── auth.js                 # Inloggning och session via Supabase Auth
│   ├── documents.js            # Dokumentbank-sidopanel
│   ├── navigation.js           # Fliknavigering + lazy mount
│   └── ai-assistant.js         # AI-analysflik med Supabase RAG ⭐
└── components/
    └── kretskampen.js          # Kretskampen quiz-app (React/JSX)
```

## Flikar

| Flik | Beskrivning |
|------|-------------|
| **Fråga ELvis** | Befintlig Zapier chatbot |
| **AI-analys** ⭐ | Ny Claude-baserad assistent med RAG mot 17 TXT-filer |
| **Kretskampen** | Quiz-app med AI-genererade frågor |

## Setup

### 1. Supabase Buckets

Skapa bucket `ai-kunskapsbas` i Supabase Storage och ladda upp de 17 TXT-filerna.

```
Supabase → Storage → New bucket → "ai-kunskapsbas" (Public)
```

Ladda upp alla TXT-filer (prislista, systemprompt, regelverksdokument etc.)

### 2. API-nyckel för Claude

Öppna `js/config.js` och ersätt:

```js
const ANTHROPIC_API_KEY = 'ERSÄTT_MED_DIN_NYCKEL';
```

> ⚠️ **Produktion:** Flytta API-anropet till en Supabase Edge Function
> så att nyckeln inte exponeras i frontend-koden.

### 3. Deploya till Netlify

```bash
# Dra in mappen i Netlify Drop, eller:
netlify deploy --prod --dir .
```

## AI RAG-arkitektur

```
Linneas fråga
      │
      ▼
Keyword-scoring mot chunks
(alla 17 TXT-filer är inladdade vid första anropet)
      │
      ▼
Top 6 relevanta chunks väljs ut
      │
      ▼
Claude API (claude-sonnet-4)
med EK system-prompt + chunks som kontext
      │
      ▼
Svar med källhänvisningar
```

### Uppgradering till pgvector (valfritt)

Om kunskapsbasen växer kan man byta keyword-scoring mot semantisk sökning:

1. Aktivera `pgvector`-extension i Supabase
2. Skapa tabell `document_chunks (id, filename, content, embedding vector(1536))`
3. Kör en Supabase Edge Function som embeddar alla filer med OpenAI
4. Uppdatera `getTopChunks()` i `ai-assistant.js` att anropa Supabase RPC

## Krav

- Supabase-projekt med:
  - Auth aktiverad
  - Bucket `intranet-dokument` (befintlig dokumentbank)
  - Bucket `ai-kunskapsbas` (de 17 TXT-filerna) ⭐ ny
  - Tabell `kretskampen_scores`
  - Edge Function `smooth-action` (Gemini quiz)
- Anthropic API-nyckel
