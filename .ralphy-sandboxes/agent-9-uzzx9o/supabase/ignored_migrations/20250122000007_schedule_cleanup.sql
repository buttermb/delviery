-- Nuclear Option Phase 3: Automation
-- Schedule the cleanup job using pg_cron

-- 1. Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule the cleanup job to run every 10 minutes
-- Cron syntax: '*/10 * * * *' = Every 10 minutes
SELECT cron.schedule(
  'cleanup_expired_reservations_job', -- Job name
  '*/10 * * * *',                     -- Schedule
  'SELECT public.cleanup_expired_reservations()' -- Command
);

-- To verify: SELECT * FROM cron.job;
-- To unschedule: SELECT cron.unschedule('cleanup_expired_reservations_job');
