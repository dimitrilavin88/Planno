-- Enable pg_cron and schedule replenish job
-- 1. Enable pg_cron: Supabase Dashboard > Database > Extensions > enable "pg_cron"
-- 2. Run this file in SQL Editor

SELECT cron.schedule(
  'replenish-recurring-meetings',
  '0 2 * * 0',  -- Every Sunday at 02:00 UTC
  $$SELECT replenish_recurring_meetings()$$
);

-- To remove the job: SELECT cron.unschedule('replenish-recurring-meetings');
