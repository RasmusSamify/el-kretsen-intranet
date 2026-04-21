-- ============================================================
--  kb-audit · pg_cron-schema
-- ============================================================
--
-- Körs EN GÅNG av Rasmus/Samify via Supabase SQL Editor när
-- Netlify-functionen är deployad och CRON_SECRET är satt som
-- env var både i Netlify OCH i Supabase Vault (eller hårdkodat
-- nedan — men vault är snyggare).
--
-- Vad detta gör:
--   1. Säkerställer pg_cron + pg_net är aktiva (migrationen gör
--      det redan, men idempotent här för säkerhet).
--   2. Schemalägger ett nattligt jobb 03:15 UTC som POST:ar till
--      /api/kb-audit-contradictions med cron-secret och batch_size.
--   3. Offsetten läses från kb_audit_state.contradiction_offset —
--      funktionen ansvarar själv för att skriva tillbaka nästa
--      offset och resetar till 0 när alla chunks processats.
--
-- Inkludera CRON_SECRET som parameter när du kör detta skript —
-- ersätt '__SAMMA_SOM_NETLIFY__' nedan.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Säkerställ state-rad finns så pg_net hittar offset första natten
INSERT INTO public.kb_audit_state (key, value)
VALUES ('contradiction_offset', jsonb_build_object('next_offset', 0, 'last_run_at', null))
ON CONFLICT (key) DO NOTHING;

-- Ta bort ev. tidigare schemaläggning med samma namn
SELECT cron.unschedule('kb-audit-contradictions-nightly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'kb-audit-contradictions-nightly'
);

-- Schemalägg nattligt jobb 03:15 UTC (~05:15 svensk sommartid)
SELECT cron.schedule(
  'kb-audit-contradictions-nightly',
  '15 3 * * *',
  $cron_body$
    SELECT net.http_post(
      url := 'https://elkretsen.netlify.app/api/kb-audit-contradictions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '__SAMMA_SOM_NETLIFY__'
      ),
      body := jsonb_build_object(
        'batch_size', 100,
        'offset', COALESCE(
          (SELECT (value->>'next_offset')::int FROM public.kb_audit_state WHERE key = 'contradiction_offset'),
          0
        )
      )
    );
  $cron_body$
);

-- Kolla att jobbet är schemalagt
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'kb-audit-contradictions-nightly';
