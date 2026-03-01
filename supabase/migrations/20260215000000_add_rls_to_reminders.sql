-- RLS for public.reminders
-- Ensures only backend (Edge Functions with service_role, SECURITY DEFINER functions) can access reminder data.
-- Clients (anon/authenticated) get no direct access; phone numbers stay protected.

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Allow the table owner (postgres) to do everything. This is required so that
-- SECURITY DEFINER functions (book_meeting, book_group_meeting) can INSERT
-- into reminders when they run as the function owner. Edge Functions use
-- service_role and bypass RLS, so they need no policy.
CREATE POLICY "reminders_backend_full_access"
  ON public.reminders
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);

-- No policies for anon or authenticated: direct client access to reminders
-- is denied. All access goes through Edge Functions (service_role) or
-- RPC (SECURITY DEFINER).
