-- Add recurrence interval to availability rules: every week (1), every other week (2), or once a month (4 weeks)
-- Run this in Supabase SQL Editor if you already have availability_rules table.

ALTER TABLE public.availability_rules
  ADD COLUMN IF NOT EXISTS interval_weeks INTEGER NOT NULL DEFAULT 1
    CHECK (interval_weeks IN (1, 2, 4));

ALTER TABLE public.availability_rules
  ADD COLUMN IF NOT EXISTS interval_start_date DATE DEFAULT NULL;

COMMENT ON COLUMN public.availability_rules.interval_weeks IS '1=every week, 2=every other week, 4=once a month (every 4 weeks)';
COMMENT ON COLUMN public.availability_rules.interval_start_date IS 'Reference date for interval; when null, created_at date is used. Slot shown when (date - ref) / 7 mod interval_weeks = 0';
