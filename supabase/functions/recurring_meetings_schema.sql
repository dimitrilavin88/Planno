-- Recurring meetings: 1-month rolling window with auto-renewal
-- Run this migration in Supabase SQL Editor

-- 1. Create recurring schedules table (stores which event types repeat weekly)
CREATE TABLE IF NOT EXISTS public.recurring_meeting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID REFERENCES public.event_types(id) ON DELETE CASCADE,
  group_event_type_id UUID REFERENCES public.group_event_types(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  interval_weeks INTEGER NOT NULL DEFAULT 1 CHECK (interval_weeks >= 1 AND interval_weeks <= 4),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recurring_schedule_event_check CHECK (
    (event_type_id IS NOT NULL AND group_event_type_id IS NULL) OR
    (event_type_id IS NULL AND group_event_type_id IS NOT NULL)
  )
);

-- Add interval_weeks if table already exists (for existing installs)
ALTER TABLE public.recurring_meeting_schedules ADD COLUMN IF NOT EXISTS interval_weeks INTEGER NOT NULL DEFAULT 1;

-- Add recurring_schedule_id to meetings (nullable, for linking)
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recurring_schedule_id UUID REFERENCES public.recurring_meeting_schedules(id) ON DELETE SET NULL;

-- RLS for recurring_meeting_schedules
ALTER TABLE public.recurring_meeting_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY recurring_schedules_select ON public.recurring_meeting_schedules
  FOR SELECT TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth
      WHERE geth.group_event_type_id = recurring_meeting_schedules.group_event_type_id
        AND geth.user_id = auth.uid()
    )
    OR (event_type_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.event_types et WHERE et.id = recurring_meeting_schedules.event_type_id AND et.user_id = auth.uid()
    ))
  );

CREATE POLICY recurring_schedules_insert ON public.recurring_meeting_schedules
  FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY recurring_schedules_update ON public.recurring_meeting_schedules
  FOR UPDATE TO authenticated
  USING (created_by_user_id = auth.uid());

CREATE POLICY recurring_schedules_delete ON public.recurring_meeting_schedules
  FOR DELETE TO authenticated
  USING (created_by_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active ON public.recurring_meeting_schedules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_meetings_recurring_schedule ON public.meetings(recurring_schedule_id) WHERE recurring_schedule_id IS NOT NULL;

-- 2. Schedule replenish job via pg_cron (run weekly on Sunday at 2am UTC)
-- Prerequisite: Enable pg_cron in Supabase Dashboard: Database > Extensions > pg_cron
-- Then run:
/*
SELECT cron.schedule(
  'replenish-recurring-meetings',
  '0 2 * * 0',  -- Every Sunday at 02:00 UTC
  $$SELECT replenish_recurring_meetings()$$
);
*/
