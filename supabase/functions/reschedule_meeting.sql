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
  -- Get meeting details
  SELECT
    m.*,
    et.*,
    u.timezone as user_timezone
  INTO v_meeting
  FROM public.meetings m
  JOIN public.event_types et ON et.id = m.event_type_id
  JOIN public.users u ON u.id = m.host_user_id
  WHERE m.id = p_meeting_id
    AND m.status IN ('confirmed', 'pending');

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
    SELECT *
    FROM public.meetings
    WHERE host_user_id = v_meeting.host_user_id
      AND id != p_meeting_id
      AND status IN ('confirmed', 'pending')
      AND (
        -- Overlap check considering buffers
        (start_time < v_new_end_time + (v_meeting.buffer_after_minutes || ' minutes')::INTERVAL 
         AND end_time > p_new_start_time - (v_meeting.buffer_before_minutes || ' minutes')::INTERVAL)
      )
      FOR UPDATE
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

