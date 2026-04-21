# Chunk-förbättringar — backlog

> Samling av konkreta idéer för att förbättra hur kunskapsbasen chunkas,
> berikas och sök genom. Sorterad efter värde/insats-ratio så ni kan plocka
> top-3 när det är dags för nästa iteration.
>
> Senast uppdaterad: 2026-04-21 (v1.2.0)

## Dagens state

- **1 661 chunks** över 138 källor
- Chunking: `CHUNK_SIZE = 1200`, `CHUNK_OVERLAP = 200`, paragraph-aware split
- Embeddings: Voyage voyage-3 (1024 dim)
- Retrieval: pgvector HNSW, cosine similarity
- `match_kb_chunks(threshold=0.25, count=10)` som standard
- Citation highlight via lexikal mening-matchning (v1.2.0)

---

## 🔥 Quick wins (S/M insats, hög impact)

### 1. Contextualized chunks
Prefixa varje chunk med dokumentets titel + sektionsrubrik innan embedding.
Istället för:
```
"Producenter ska registrera sig hos Naturvårdsverket..."
```
lagras:
```
"SFS 2025:813 · Registrering · Producenter ska registrera sig hos Naturvårdsverket..."
```
Embeddings blir dramatiskt bättre på att skilja "producentregistrering för batterier"
från "producentregistrering för WEEE" när kontexten följer med.
**Insats:** S (ändra chunking-logik). **Värde:** M-L.

### 2. Metadata-kolumner (paragraph, section, chapter)
Lägg till kolumner i `kb_chunks`:
- `section text` (t.ex. "Registrering")
- `paragraph_ref text` (t.ex. "§ 9")
- `law_ref text` (t.ex. "SFS 2025:813")

Kan extraheras med regex vid indexering. Möjliggör strukturerade filter:
"visa bara chunks från SFS 2022:1276 kapitel 3". Också bättre citations i UI.
**Insats:** M. **Värde:** L.

### 3. Smart overlap med mening-gräns
Dagens `CHUNK_OVERLAP = 200` splittar ofta mitt i en mening. Ändra så overlap är
"senaste hela meningen" (upp till 300 tecken). Förbättrar läsbarhet i citation-chips.
**Insats:** S. **Värde:** M.

### 4. Query expansion för produktkoder
Om användaren skriver bara "B74" → expandera automatiskt till "B74 Li-jon LFP batteri"
innan embedding. Kan göras med en lookup-tabell från prislistan.
**Insats:** S. **Värde:** M.

### 5. Voyage Reranker (vi diskuterade detta)
Cross-encoder som rankar retrieval-resultat efter relevans. Halverar false positives,
sänker Claude-kostnaden.
**Insats:** S. **Värde:** M.

---

## 🧱 Chunking-strategi (M insats)

### 6. Hierarkisk chunking (small + large)
Indexera i två nivåer:
- **Små chunks** (400 tecken) — används för precis sökning
- **Stora chunks** (2 500 tecken) — används för kontext när Claude genererar svar

Flöde: sök i små → hämta motsvarande stora → skicka stora till Claude.
Klassiskt mönster. Mest impact när källorna är långa lagtexter.
**Insats:** M. **Värde:** L.

### 7. Dokument-typspecifik chunking
Olika regler per filtyp:
- **Lagar** (SFS, EU-direktiv) → split på `§` eller `Artikel X`
- **Prislistor** → en rad = en chunk (kod + produkt + pris = liten självständig enhet)
- **Artiklar/news** → split på rubriker
- **Interna PDF:er** → nuvarande paragraph-split

Vi har redan en Prislista_2026_RAG.txt som är handbyggd för detta. Generalisera logiken.
**Insats:** M-L. **Värde:** L.

### 8. Semantisk chunking
Istället för fixed-size: använd embeddings för att detektera när ämnet byter.
Två angränsande meningar med låg cosine → brytpunkt.
Algoritm: Greene-Riedl, Llamaindex semantic splitter eller egen.
**Insats:** L. **Värde:** M (vinner mest på långa löptexter).

---

## 🏷️ Metadata-berikning

### 9. Chunk summary (AI-genererad)
Vid indexering, be Claude Haiku skapa en 1-rads sammanfattning per chunk.
Spara som `summary text`. Vinsten:
- Visa summary i citation-chips istället för rå chunk
- Söker kan ibland göras bara på summaries (snabbare)
- Sammanfattningar brukar ha högre signal-to-noise än raw chunks

Kostnad: engångs-1 kr per 100 chunks via Haiku. ~20 kr för hela KB.
**Insats:** M. **Värde:** M-L.

### 10. Entity extraction
Extrahera strukturerad data per chunk:
```json
{
  "product_codes": ["B74", "B77"],
  "law_refs": ["SFS 2022:1276"],
  "dates": ["2027-01-01"],
  "amounts": ["10 kr/kg", "500 kr/år"]
}
```
Lagra som jsonb-kolumn. Möjliggör exakta filter i UI:
*"visa alla chunks som nämner B74"*.
**Insats:** M. **Värde:** M.

### 11. Språktaggning per chunk
Boolean `is_swedish`, `is_english`. Viktigt när ni lägger till engelska källor
(EU-förordningar). Embeddings är redan språkagnostiska, men filtrering i UI blir renare.
**Insats:** S. **Värde:** S-M.

### 12. Chunk quality score
Beräkna vid indexering:
- Längd (för kort = brus, för lång = risk för blandat ämne)
- Ratio alphanumeriska tecken / totalt
- Antal meningar
- Har URL/email/boilerplate-mönster?

Score 0-100 som kolumn. Används för:
- Nedrankning i sökning
- Röd flagga i admin-UI ("granska denna")
**Insats:** M. **Värde:** S-M.

---

## 🧹 Kvalitet & hygien

### 13. Boilerplate-detection (för crawlade sidor)
Cookie-banners, "Accept all cookies", footer-länkar osv. kommer ofta med från crawl.
Vi har grundläggande filter i `ingest-url`, men kan förbättras:
- Identifiera text som syns på MÅNGA olika chunks från samma domän → boilerplate
- Ta bort automatiskt vid indexering
**Insats:** M. **Värde:** M.

### 14. Dubblettdetektion (utökning av audit-systemet)
Vi har contradiction-detection i v1.1.0. Lägg till `issue_type: 'duplicate'`:
- Par med cosine > 0.95 → markera som potentiell dublett
- Admin kan välja "behåll båda" eller "slå ihop"
- Slå ihop = ta bort ena, behåll som längsta
**Insats:** S (återanvänder kb-audit-pipelinen). **Värde:** M.

### 15. Stale-detection för URL-källor
Periodisk re-fetch av crawlade URL:er, cosine mellan gammal och ny chunks.
Om stor skillnad → flagga för granskning.
**Insats:** M-L (nytt cron-jobb). **Värde:** M (viktigt för lagtexter som uppdateras).

### 16. Unicode-normalisering (NFC)
Innan embedding, normalisera all text till NFC-form. Förhindrar att
"ö" (U+00F6) och "ö" (U+006F + U+0308) behandlas som olika tecken.
En-linje-fix vid indexering.
**Insats:** XS. **Värde:** S (förbättrar precision på edge cases).

---

## 🔍 Sökförbättringar

### 17. Hybrid search (BM25 + embeddings)
Dagens RAG är ren semantic. Kombinera med Postgres full-text search (tsvector):
- Embeddings hittar konceptuellt lika
- BM25 hittar exakt matchande termer (produktkoder, paragrafnummer)
- Merge resultat via Reciprocal Rank Fusion

Kritiskt för koder som "B74" eller "§ 12" där embeddings ibland missar.
**Insats:** M. **Värde:** L.

### 18. Multi-query retrieval
Istället för en sökning: be Claude Haiku generera 2-3 omformulerade versioner av frågan,
sök på alla, union:a resultaten. Förbättrar recall dramatiskt.
**Insats:** S. **Värde:** M.

### 19. Parent-child retrieval
Sök i små chunks (bättre precision), men hämta deras "parent paragraph"
(större kontext) när Claude genererar svaret. Löser "jag hittade rätt mening men
Claude saknar omgivningen för att tolka den".
**Insats:** M. **Värde:** M-L.

### 20. Adaptive match_threshold
Dagens `MATCH_THRESHOLD = 0.25` är statisk. Låt den variera:
- Vid få träffar (< 3) → sänk till 0.15
- Vid många träffar (> 8) → höj till 0.35

Ger bättre användarupplevelse för både vaga och specifika frågor.
**Insats:** S. **Värde:** S-M.

---

## 📅 Versionering & spårbarhet

### 21. Chunk version history
När en chunk uppdateras (admin redigerar eller re-crawl): behåll gamla versionen i
`kb_chunk_history`-tabell. Möjliggör "visa vad ELvis hade åtkomst till 2026-03-15".
Viktigt för compliance.
**Insats:** M. **Värde:** M (extra compliance-säkerhet).

### 22. Source effective_from / effective_to
När t.ex. SFS 2025:813 ersätter äldre paragraf: tagga gamla chunks med `effective_to`
och nya med `effective_from`. Sök kan defaulta till "bara aktiva" men admin kan
se historik.
**Insats:** M. **Värde:** M.

---

## Prioriteringstabell

| # | Namn | Insats | Värde | Bra att göra när... |
|---|---|---|---|---|
| 1 | Contextualized chunks | S | M-L | Ni märker att sökning blandar mellan liknande lagar |
| 2 | Metadata-kolumner | M | L | Ni vill ha strukturerade filter i UI |
| 6 | Hierarkisk chunking | M | L | Långa lagtexter ger suboptimala svar |
| 7 | Typspecifik chunking | M-L | L | Ni lägger till många nya filtyper |
| 9 | Chunk summary | M | M-L | Citations-chips upplevs fortfarande för långa |
| 17 | Hybrid search | M | L | Produktkoder/paragrafsök inte fångas |
| 5 | Voyage Reranker | S | M | Claude-kostnaderna blir oroande |
| 14 | Dubblettdetektion | S | M | Audit-systemet visar samma info från flera källor |

---

## Om ni vill starta någonstans

**Första iterationen (~1 arbetsdag):**
1. Contextualized chunks (nr 1)
2. Metadata-kolumner (nr 2)
3. Unicode-normalisering (nr 16)

Tre förändringar som tillsammans lyfter retrieval-kvaliteten märkbart utan att
kräva stor omskrivning. Kräver re-indexering av alla 1 661 chunks — engångskostnad
~400 kr i Voyage-tokens (eller gratis inom free tier om ni inte hunnit över 200M).

**Andra iterationen — sök-förbättringar:**
4. Hybrid search (nr 17)
5. Voyage reranker (nr 5)

**Tredje — när ni har tid för UX-polish:**
6. Hierarkisk chunking (nr 6)
7. Chunk summary (nr 9)
