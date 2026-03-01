-- Rate limiting for booking and API endpoints (ai-rules: security, supabase-backend)
-- Single shared store: rate_limit_attempts. check_rate_limit() used by booking RPCs and server-side API routes.

CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_bucket_created
  ON public.rate_limit_attempts (bucket_key, created_at DESC);

ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- No policies: only backend (postgres in RPC, service_role from API) can access.
-- Allow postgres to insert/select for the function; service_role bypasses RLS.
CREATE POLICY "rate_limit_backend_all"
  ON public.rate_limit_attempts
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);

-- Function: check and record one attempt; returns true if under limit, false if over.
-- Prunes old rows, inserts one, counts in window; if over limit, deletes the new row and returns false.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket_key TEXT,
  p_max_count INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count BIGINT;
BEGIN
  -- Prune old rows (keep 2x window for safety)
  DELETE FROM public.rate_limit_attempts
  WHERE created_at < NOW() - (p_window_seconds * 2 || ' seconds')::INTERVAL;

  INSERT INTO public.rate_limit_attempts (bucket_key)
  VALUES (p_bucket_key)
  RETURNING id INTO v_id;

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_attempts
  WHERE bucket_key = p_bucket_key
    AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  IF v_count > p_max_count THEN
    DELETE FROM public.rate_limit_attempts WHERE id = v_id;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- postgres (definer of book_meeting/book_group_meeting) and service_role (Next.js server) can call.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
-- Owner (postgres) can always execute; no need to grant explicitly.

COMMENT ON TABLE public.rate_limit_attempts IS 'Rate limit attempt log; used by check_rate_limit(). RLS restricts to backend only.';
COMMENT ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) IS 'Returns true if bucket is under limit, false otherwise. Call from RPC (postgres) or server (service_role) only.';
