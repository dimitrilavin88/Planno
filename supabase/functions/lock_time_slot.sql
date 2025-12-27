-- Function to lock a time slot temporarily (prevents double-booking during booking process)
-- Locks expire after 30 seconds

CREATE OR REPLACE FUNCTION public.lock_time_slot(
  p_user_id UUID,
  p_event_type_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_lock_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_existing_lock RECORD;
BEGIN
  v_expires_at := NOW() + INTERVAL '30 seconds';

  -- Check if there's an existing valid lock
  SELECT * INTO v_existing_lock
  FROM public.time_slot_locks
  WHERE user_id = p_user_id
    AND event_type_id = p_event_type_id
    AND start_time = p_start_time
    AND end_time = p_end_time
    AND expires_at > NOW();

  IF FOUND AND v_existing_lock.locked_by != p_lock_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Time slot is currently locked'
    );
  END IF;

  -- Clean up expired locks
  DELETE FROM public.time_slot_locks
  WHERE expires_at <= NOW();

  -- Create or update lock
  INSERT INTO public.time_slot_locks (
    user_id,
    event_type_id,
    start_time,
    end_time,
    locked_by,
    expires_at
  ) VALUES (
    p_user_id,
    p_event_type_id,
    p_start_time,
    p_end_time,
    p_lock_id,
    v_expires_at
  )
  ON CONFLICT DO NOTHING;

  -- If nothing was inserted, try update
  IF NOT FOUND THEN
    UPDATE public.time_slot_locks
    SET expires_at = v_expires_at
    WHERE user_id = p_user_id
      AND event_type_id = p_event_type_id
      AND start_time = p_start_time
      AND end_time = p_end_time
      AND locked_by = p_lock_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.lock_time_slot(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_time_slot(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;

