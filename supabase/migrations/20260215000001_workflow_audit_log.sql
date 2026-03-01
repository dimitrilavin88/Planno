-- Workflow audit log for booking and auth visibility (ai-rules: audit logging)
-- Stores booking_created, booking_rescheduled, booking_cancelled, series_cancelled.
-- Auth failures can be added later via app or Auth Hook.

CREATE TABLE IF NOT EXISTS public.workflow_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT workflow_audit_log_event_type_check
    CHECK (event_type IN ('booking_created', 'booking_rescheduled', 'booking_cancelled', 'series_cancelled', 'auth_failure')),
  CONSTRAINT workflow_audit_log_resource_type_check
    CHECK (resource_type IN ('meeting', 'recurring_schedule')),
  CONSTRAINT workflow_audit_log_action_check
    CHECK (action IN ('created', 'updated', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_log_occurred_at
  ON public.workflow_audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_log_resource
  ON public.workflow_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_log_event_type
  ON public.workflow_audit_log (event_type);

ALTER TABLE public.workflow_audit_log ENABLE ROW LEVEL SECURITY;

-- Only backend (postgres / SECURITY DEFINER) can insert. No policies for anon/authenticated.
CREATE POLICY "workflow_audit_log_backend_insert"
  ON public.workflow_audit_log
  FOR INSERT
  TO postgres
  WITH CHECK (true);

-- Only backend can read (for dashboards or exports; service_role bypasses RLS).
CREATE POLICY "workflow_audit_log_backend_select"
  ON public.workflow_audit_log
  FOR SELECT
  TO postgres
  USING (true);

-- No one can update or delete audit rows.
-- No policy for UPDATE/DELETE => no role can do it (except superuser if needed for retention).

COMMENT ON TABLE public.workflow_audit_log IS 'Audit trail for booking and workflow events; RLS restricts to backend only.';
