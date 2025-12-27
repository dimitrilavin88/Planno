-- Database trigger function to call Edge Functions after meeting creation
-- This triggers webhooks to create calendar events and send emails

CREATE OR REPLACE FUNCTION public.trigger_meeting_webhooks()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Functions via HTTP (using pg_net extension if available)
  -- Or use Supabase Database Webhooks feature instead
  
  -- For now, we'll use a placeholder that can be replaced with actual webhook calls
  -- In production, set up Database Webhooks in Supabase Dashboard:
  -- 1. Go to Database > Webhooks
  -- 2. Create webhook for INSERT on meetings table
  -- 3. Point to: https://your-project.supabase.co/functions/v1/create-calendar-event
  -- 4. Create another webhook pointing to: https://your-project.supabase.co/functions/v1/send-booking-email
  
  -- Example using pg_net (if extension is enabled):
  -- PERFORM net.http_post(
  --   url := current_setting('app.supabase_url') || '/functions/v1/create-calendar-event',
  --   headers := jsonb_build_object(
  --     'Content-Type', 'application/json',
  --     'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
  --   ),
  --   body := jsonb_build_object('meeting_id', NEW.id)
  -- );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_meeting_created ON public.meetings;
CREATE TRIGGER on_meeting_created
  AFTER INSERT ON public.meetings
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION public.trigger_meeting_webhooks();

-- Note: In production, use Supabase Database Webhooks feature instead of this trigger
-- The trigger function above is a placeholder showing the concept

