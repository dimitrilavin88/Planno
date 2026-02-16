-- Fetch meeting details for cancel/reschedule actions
-- Bypasses RLS; returns meeting only if user is host or participant

CREATE OR REPLACE FUNCTION public.get_meeting_for_cancel(p_meeting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_meeting RECORD;
  v_title TEXT;
  v_event_type_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.id, m.title, m.start_time, m.end_time, m.event_type_id, m.recurring_schedule_id,
         et.name AS event_type_name
  INTO v_meeting
  FROM public.meetings m
  LEFT JOIN public.event_types et ON et.id = m.event_type_id
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

  v_title := COALESCE(v_meeting.event_type_name, v_meeting.title, 'Meeting');

  RETURN jsonb_build_object(
    'id', v_meeting.id,
    'title', v_title,
    'start_time', v_meeting.start_time,
    'end_time', v_meeting.end_time,
    'recurring_schedule_id', v_meeting.recurring_schedule_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meeting_for_cancel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meeting_for_cancel(UUID) TO anon;
