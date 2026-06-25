-- Schedule poll-lead-status to run every 5 minutes
-- Enables automatic FTD detection from MegaTron/EliteCRM and all other advertisers

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-lead-status-every-5min') THEN
    PERFORM cron.unschedule('poll-lead-status-every-5min');
  END IF;
END;
$$;

SELECT cron.schedule(
  'poll-lead-status-every-5min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xdwpyqpnuxvuvnzzwhcl.supabase.co/functions/v1/poll-lead-status',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE5MDAwMDAwMDB9.vTj1lnEkAJvR2yms3HbecBoOjaUsQMELTwPY6fbz6V0"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
