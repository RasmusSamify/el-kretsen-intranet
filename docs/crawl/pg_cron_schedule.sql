-- ============================================================
--  Schemalagd om-crawl av el-kretsen.se · pg_cron
-- ============================================================
--
-- Körs EN GÅNG i Supabase SQL Editor EFTER att functionen
-- /api/scheduled-crawl är deployad och CRON_SECRET är satt som
-- env var i Netlify. Ersätt '__SAMMA_SOM_NETLIFY__' nedan med
-- samma värde som CRON_SECRET i Netlify.
--
-- Vad detta gör:
--   1. Veckojobb (söndag 02:15 UTC) → POST {action:'start'} som
--      bygger en färsk URL-lista från sitemaps och crawlar första
--      batchen. Resten av listan ligger kvar i kb_audit_state.
--   2. Var 10:e minut → POST {action:'advance'} som processar nästa
--      batch tills listan är slut. När inget pågår är anropet en
--      billig no-op (returnerar {idle:true}).
--   3. När hela listan är klar skrivs en heartbeat i
--      kb_audit_state['last_crawl'] som Systemstatus-sidan visar.
--
-- En full crawl (~120 sidor, 6 per batch, var 10:e min) tar ca 3-4 h
-- och sprids ut så vi aldrig slår i Netlifys 26s-tak.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Ta bort ev. tidigare schemaläggning med samma namn
SELECT cron.unschedule('elkretsen-crawl-kickoff-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'elkretsen-crawl-kickoff-weekly');

SELECT cron.unschedule('elkretsen-crawl-advance')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'elkretsen-crawl-advance');

-- 1) Veckovis kickoff: söndag 02:15 UTC
SELECT cron.schedule(
  'elkretsen-crawl-kickoff-weekly',
  '15 2 * * 0',
  $cron_body$
    SELECT net.http_post(
      url := 'https://elkretsen.netlify.app/api/scheduled-crawl',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '__SAMMA_SOM_NETLIFY__'
      ),
      body := jsonb_build_object('action', 'start')
    );
  $cron_body$
);

-- 2) Var 10:e minut: processa nästa batch (no-op om inget pågår)
SELECT cron.schedule(
  'elkretsen-crawl-advance',
  '*/10 * * * *',
  $cron_body$
    SELECT net.http_post(
      url := 'https://elkretsen.netlify.app/api/scheduled-crawl',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '__SAMMA_SOM_NETLIFY__'
      ),
      body := jsonb_build_object('action', 'advance')
    );
  $cron_body$
);

-- Verifiera
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('elkretsen-crawl-kickoff-weekly', 'elkretsen-crawl-advance')
ORDER BY jobname;
