-- Cancel entire recurring meeting series
-- Deactivates the schedule and cancels all future meetings in the series

CREATE OR REPLACE FUNCTION public.cancel_recurring_series(
  p_recurring_schedule_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_can_access BOOLEAN;
  v_cancelled_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify user has access (creator, event type owner, or group host)
  SELECT EXISTS (
    SELECT 1 FROM public.recurring_meeting_schedules rms
    WHERE rms.id = p_recurring_schedule_id
      AND (
        rms.created_by_user_id = v_user_id
        OR (rms.event_type_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.event_types et
          WHERE et.id = rms.event_type_id AND et.user_id = v_user_id
        ))
        OR (rms.group_event_type_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_event_type_hosts geth
          WHERE geth.group_event_type_id = rms.group_event_type_id
            AND geth.user_id = v_user_id
        ))
      )
  ) INTO v_can_access;

  IF NOT v_can_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Deactivate the schedule (stops future replenishment)
  UPDATE public.recurring_meeting_schedules
  SET is_active = false, updated_at = NOW()
  WHERE id = p_recurring_schedule_id;

  -- Cancel all future meetings in this series
  WITH cancelled AS (
    UPDATE public.meetings
    SET status = 'cancelled', updated_at = NOW()
    WHERE recurring_schedule_id = p_recurring_schedule_id
      AND status IN ('confirmed', 'pending')
      AND start_time >= NOW()
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_cancelled_count FROM cancelled;

  -- Cancel participant statuses for all meetings in this series that are now cancelled
  UPDATE public.meeting_participants mp
  SET status = 'cancelled', updated_at = NOW()
  FROM public.meetings m
  WHERE m.id = mp.meeting_id
    AND m.recurring_schedule_id = p_recurring_schedule_id
    AND m.status = 'cancelled'
    AND mp.status != 'cancelled';

  -- Audit: series cancelled
  INSERT INTO public.workflow_audit_log (event_type, actor_user_id, resource_type, resource_id, action, details)
  VALUES (
    'series_cancelled',
    v_user_id,
    'recurring_schedule',
    p_recurring_schedule_id,
    'cancelled',
    jsonb_build_object(
      'cancelled_count', v_cancelled_count,
      'cancelled_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'recurring_schedule_id', p_recurring_schedule_id,
    'cancelled_count', v_cancelled_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An error occurred: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_recurring_series(UUID) TO authenticated;
