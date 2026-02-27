-- SMS Reminders infrastructure (Twilio)
-- Creates reminder_status enum and reminders table

-- Create enum type for reminder status if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'reminder_status'
  ) THEN
    CREATE TYPE public.reminder_status AS ENUM ('pending', 'sent', 'delivered', 'failed');
  END IF;
END;
$$;

-- Reminders table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status public.reminder_status NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  twilio_message_sid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes to support scheduled processing
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_for
  ON public.reminders (scheduled_for);

CREATE INDEX IF NOT EXISTS idx_reminders_status
  ON public.reminders (status);

-- Optional: avoid duplicate tracking rows for the same Twilio message
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_twilio_message_sid
  ON public.reminders (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

