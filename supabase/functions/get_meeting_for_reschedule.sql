-- Fetch meeting details for reschedule page (individual and group events)
-- Bypasses RLS; returns meeting + event type only if user is host or participant

CREATE OR REPLACE FUNCTION public.get_meeting_for_reschedule(p_meeting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_meeting RECORD;
  v_event_type RECORD;
  v_group_event_type RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fetch meeting only if user is host or participant (include title for group lookup)
  SELECT m.id, m.start_time, m.end_time, m.event_type_id, m.host_user_id, m.timezone, m.title
  INTO v_meeting
  FROM public.meetings m
  WHERE m.id = p_meeting_id
    AND m.status IN ('confirmed', 'pending')
    AND (
      m.host_user_id = v_user_id
      OR EXISTS (
        SELECT 1 FROM public.meeting_participants mp
        WHERE mp.meeting_id = m.id AND mp.user_id = v_user_id
      )
    );

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Individual event: need event type for duration, notice, buffers
  IF v_meeting.event_type_id IS NOT NULL THEN
    SELECT et.name, et.duration_minutes, et.minimum_notice_hours,
           COALESCE(et.buffer_before_minutes, 0) AS buffer_before_minutes,
           COALESCE(et.buffer_after_minutes, 0) AS buffer_after_minutes
    INTO v_event_type
    FROM public.event_types et
    WHERE et.id = v_meeting.event_type_id;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
      'id', v_meeting.id,
      'start_time', v_meeting.start_time,
      'end_time', v_meeting.end_time,
      'event_type_id', v_meeting.event_type_id,
      'group_event_type_id', NULL,
      'is_group', false,
      'host_user_id', v_meeting.host_user_id,
      'timezone', v_meeting.timezone,
      'event_type', jsonb_build_object(
        'name', v_event_type.name,
        'duration_minutes', v_event_type.duration_minutes,
        'minimum_notice_hours', v_event_type.minimum_notice_hours,
        'buffer_before_minutes', v_event_type.buffer_before_minutes,
        'buffer_after_minutes', v_event_type.buffer_after_minutes
      )
    );
  END IF;

  -- Group meeting: find group event type by host + meeting title (group meetings use event type name as title)
  SELECT get.id, get.name, get.duration_minutes, get.minimum_notice_hours
  INTO v_group_event_type
  FROM public.group_event_types get
  JOIN public.group_event_type_hosts geth ON geth.group_event_type_id = get.id
  WHERE geth.user_id = v_meeting.host_user_id
    AND get.name = v_meeting.title
    AND get.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_meeting.id,
    'start_time', v_meeting.start_time,
    'end_time', v_meeting.end_time,
    'event_type_id', NULL,
    'group_event_type_id', v_group_event_type.id,
    'is_group', true,
    'host_user_id', v_meeting.host_user_id,
    'timezone', v_meeting.timezone,
    'event_type', jsonb_build_object(
      'name', v_group_event_type.name,
      'duration_minutes', v_group_event_type.duration_minutes,
      'minimum_notice_hours', v_group_event_type.minimum_notice_hours,
      'buffer_before_minutes', 0,
      'buffer_after_minutes', 0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meeting_for_reschedule(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meeting_for_reschedule(UUID) TO anon;
