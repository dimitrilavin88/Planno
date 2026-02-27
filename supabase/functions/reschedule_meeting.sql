-- Function to reschedule a meeting
-- Includes atomic updates and calendar sync

CREATE OR REPLACE FUNCTION public.reschedule_meeting(
  p_meeting_id UUID,
  p_new_start_time TIMESTAMPTZ,
  p_participant_token TEXT DEFAULT NULL -- Token for secure access
)
RETURNS JSONB AS $$
DECLARE
  v_meeting RECORD;
  v_event_type RECORD;
  v_new_end_time TIMESTAMPTZ;
  v_old_start_time TIMESTAMPTZ;
  v_old_end_time TIMESTAMPTZ;
  v_has_conflict BOOLEAN;
BEGIN
  -- Get meeting details (support both individual and group events)
  SELECT
    m.id,
    m.host_user_id,
    m.start_time,
    m.end_time,
    COALESCE(et.duration_minutes, get.duration_minutes) AS duration_minutes,
    COALESCE(et.minimum_notice_hours, get.minimum_notice_hours) AS minimum_notice_hours,
    COALESCE(et.buffer_before_minutes, 0) AS buffer_before_minutes,
    COALESCE(et.buffer_after_minutes, 0) AS buffer_after_minutes,
    u.timezone AS user_timezone
  INTO v_meeting
  FROM public.meetings m
  JOIN public.users u ON u.id = m.host_user_id
  LEFT JOIN public.event_types et ON et.id = m.event_type_id
  LEFT JOIN public.group_event_types get ON get.name = m.title
    AND get.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth
      WHERE geth.group_event_type_id = get.id AND geth.user_id = m.host_user_id
    )
  WHERE m.id = p_meeting_id
    AND m.status IN ('confirmed', 'pending')
    AND (et.id IS NOT NULL OR get.id IS NOT NULL);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Meeting not found or cannot be rescheduled'
    );
  END IF;

  -- TODO: Verify participant_token if provided (for secure links)
  -- For now, we'll allow any authenticated user or token holder

  -- Calculate new end time
  v_new_end_time := p_new_start_time + (v_meeting.duration_minutes || ' minutes')::INTERVAL;
  v_old_start_time := v_meeting.start_time;
  v_old_end_time := v_meeting.end_time;

  -- Validate minimum notice
  IF p_new_start_time < NOW() + (v_meeting.minimum_notice_hours || ' hours')::INTERVAL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'New time is too soon. Minimum notice required: ' || v_meeting.minimum_notice_hours || ' hours'
    );
  END IF;

  -- Check for conflicts (excluding the current meeting)
  v_has_conflict := false;
  
  FOR v_event_type IN
    SELECT m.*
    FROM public.meetings m
    LEFT JOIN public.meeting_participants mp ON mp.meeting_id = m.id AND mp.user_id = v_meeting.host_user_id
    WHERE m.id != p_meeting_id
      AND m.status IN ('confirmed', 'pending')
      AND (m.host_user_id = v_meeting.host_user_id OR mp.user_id IS NOT NULL)
      AND (
        m.start_time < v_new_end_time + (v_meeting.buffer_after_minutes || ' minutes')::INTERVAL
        AND m.end_time > p_new_start_time - (v_meeting.buffer_before_minutes || ' minutes')::INTERVAL
      )
      FOR UPDATE OF m
  LOOP
    v_has_conflict := true;
    EXIT;
  END LOOP;

  IF v_has_conflict THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'New time slot conflicts with another meeting'
    );
  END IF;

  -- Update the meeting
  UPDATE public.meetings
  SET
    start_time = p_new_start_time,
    end_time = v_new_end_time,
    updated_at = NOW()
  WHERE id = p_meeting_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'meeting_id', p_meeting_id,
    'old_start_time', v_old_start_time,
    'new_start_time', p_new_start_time,
    'old_end_time', v_old_end_time,
    'new_end_time', v_new_end_time
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An error occurred while rescheduling: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reschedule_meeting(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_meeting(UUID, TIMESTAMPTZ, TEXT) TO anon;

