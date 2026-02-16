-- Add interval_weeks column to recurring_meeting_schedules (for existing installs)
-- Run this in Supabase SQL Editor if you get "column interval_weeks does not exist"

ALTER TABLE public.recurring_meeting_schedules 
ADD COLUMN IF NOT EXISTS interval_weeks INTEGER NOT NULL DEFAULT 1;
