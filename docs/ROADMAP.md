# ELvis Hub — Roadmap

Status per 2026-05-30. Levande dokument för vad som är gjort och vad som väntar.

---

## ✅ Klart (v1.8.0 — branch `feat/elvira-systemstatus-kunskapsluckor`, PR #1)

Ej mergat till main / ej live till kund ännu — testas i Netlify-preview.

- **Elvira** — mail-assistenten omdöpt (ELvis = chatten). Insikter delad i ELvis/Elvira-flikar + feedback-ström.
- **Mallar-bibliotek** i Elvira + varje svar visar vilken mall det byggde på.
- **Granskning → Kunskapsluckor** — obesvarade frågor → grundat AI-utkast (platshållare, hittar ej på fakta) → admin verifierar → ingest.
- **Systemstatus** — live-koll av tjänster + senast uppdaterat + manuella körknappar (crawl/audit/drift). Funktionsbaserade tjänstenamn.
- **Schemalagd crawl** — måndag 06:00 (svensk sommartid) via pg_cron. Audit körs nattligt.
- **Loggbok** (admin) — möten/samtal + feedback → AI-sammanfattning + action points.
- **Säkerhet** — `ingest-url`/`ingest-file` låsta (admin-JWT eller intern secret).
- Borttaget: Avgifts-kalkylator + Avgifts-duellen.

---

## 🔜 Nästa features (designade, ej byggda)

### 1. Skrivelse-/dokumentgenerator
Proaktiv motsats till Elvira: generera **utgående** kommunikation grundad i KB.
- **UI:** ny sida — välj dokumenttyp + kort brief + språk (sv/en) → genererad skrivelse (kopierbar) + flaggade luckor + källor.
- **Dokumenttyper (förslag):** Producentbrev · Regeländring/deadline-påminnelse · Regelsammanfattning (plain language) · Fritt.
- **Endpoint:** `/api/generate-document` — embedda brief → RAG (`match_kb_chunks_hybrid_v2`) → Claude (samma grounding-regler som Elvira: hittar ej på fakta, listar `gaps`). Endpoint-design fanns klar och kan återskapas snabbt.
- **Öppen fråga till Linnea:** vilka brevtyper skickar ni oftast? (styr presets)
- **Effort:** liten–medel (nästan klon av mail-assistenten, omvänd).

### 2. Regelradar (lagbevakning)
Bevaka att lagar/EU-direktiv som KB:n citerar inte ändrats + plain-language "vad har ändrats".
- Återanvänder drift-infran men riktad mot **lagkällor** (riksdagen.se, EUR-Lex) i stället för el-kretsen.se (som ändå re-crawlas varje vecka).
- Schemalagd koll → AI-diff-sammanfattning → flagga i Granskning (ny issue-type, kan återanvända `kb_review_queue`/`kb_source_drift`).
- **Öppen fråga till Linnea:** vilka specifika lagar/direktiv ska bevakas? (t.ex. SFS-nummer, WEEE-direktivet, EU-batteriförordningen)
- **Effort:** störst — kräver källista + schemaläggning + diff-logik.

### 3. Onboarding-läranväg (idé, ej prioriterad)
Bygg ut Kretskampen till strukturerad intro för nyanställda (producentansvar, batterier, WEEE) med progress.

---

## 🔧 Förbättrings-backlog (från systemgranskning 2026-05-30)

- **Modelluppgradering:** Claude Sonnet 4 (maj-25) är hårdkodad i mail/audit/close-gap/meeting-logs/generate-document. Överväg nyare Sonnet → bättre kvalitet, ofta lägre kostnad. Byt `CLAUDE_MODEL`-konstanten i berörda functions.
- **Drift-koll vs veckocrawl:** drift-kollen kollar bara webbsidor som ändå re-crawlas varje måndag → liten nytta i nuläget. Lös via Regelradar (rikta om mot lagkällor) eller avveckla det nattliga drift-behovet.
- **`kb_sources.updated_at`** bumpas inte vid re-crawl (upsert sätter bara default på insert). Kosmetiskt — Systemstatus använder crawl-heartbeat i stället. Fixa ev. med trigger om per-källa-tidsstämpel ska stämma.
- **Aktivera/verifiera crawl-cron efter deploy:** `elkretsen-crawl-*`-jobben pekar på `/api/scheduled-crawl` som behöver vara deployad för att fungera (kör annars 404 tills merge till main).

---

## 📌 Driftsnotiser

- DB-migrationer körs direkt mot Supabase-prod via MCP (repot spårar inte migrations-filer). Schemat i prod kan ligga före koden på en feature-branch.
- pg_cron-jobb (audit nattligt, crawl måndag) är redan schemalagda i Supabase och innehåller `CRON_SECRET` i jobb-definitionen.
- `CRON_SECRET` finns i Netlify + lokal `.env.local`.
