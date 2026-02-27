-- Public-safe booking confirmation fetch
-- Used by /booking/confirmed/[meetingId] so guests can see confirmation details

CREATE OR REPLACE FUNCTION public.get_booking_confirmation(
  p_meeting_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting RECORD;
BEGIN
  SELECT
    m.id,
    m.start_time,
    m.end_time,
    m.timezone,
    m.location_type,
    m.location,
    COALESCE(et.name, m.title, 'Meeting') AS title,
    COALESCE(et.description, m.description, '') AS description,
    u.id AS host_user_id,
    u.username AS host_username
  INTO v_meeting
  FROM public.meetings m
  LEFT JOIN public.event_types et ON et.id = m.event_type_id
  LEFT JOIN public.users u ON u.id = m.host_user_id
  WHERE m.id = p_meeting_id
    AND m.status IN ('confirmed', 'pending')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_meeting.id,
    'title', v_meeting.title,
    'description', v_meeting.description,
    'start_time', v_meeting.start_time,
    'end_time', v_meeting.end_time,
    'timezone', v_meeting.timezone,
    'location_type', v_meeting.location_type,
    'location', v_meeting.location,
    'host_user_id', v_meeting.host_user_id,
    'host_username', v_meeting.host_username
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_confirmation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_confirmation(UUID) TO anon;

