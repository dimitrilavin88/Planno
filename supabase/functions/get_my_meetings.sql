-- Fetch meetings for the logged-in user (host OR participant)
-- Bypasses RLS via SECURITY DEFINER; security enforced by function (auth.uid() only)
-- Returns JSONB array of meetings with participants and event_type info

CREATE OR REPLACE FUNCTION public.get_my_meetings(p_upcoming BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  IF p_upcoming THEN
    SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'start_time')::timestamptz), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
      'id', m.id,
      'host_user_id', m.host_user_id,
      'event_type_id', m.event_type_id,
      'title', m.title,
      'description', m.description,
      'start_time', m.start_time,
      'end_time', m.end_time,
      'timezone', m.timezone,
      'location_type', m.location_type,
      'location', m.location,
      'status', m.status,
      'event_types', (
        SELECT jsonb_build_object(
          'name', et.name,
          'location_type', et.location_type,
          'location', et.location
        )
        FROM public.event_types et
        WHERE et.id = m.event_type_id
      ),
      'participants', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'name', COALESCE(
            NULLIF(TRIM(mp.name), ''),
            CASE WHEN mp.is_host AND mp.user_id IS NOT NULL
              THEN public.get_user_display_name(mp.user_id)
              ELSE 'Guest' END
          ),
          'email', mp.email,
          'is_host', mp.is_host
        ))
         FROM public.meeting_participants mp
         WHERE mp.meeting_id = m.id),
        '[]'::JSONB
      )
    ) AS row
    FROM public.meetings m
    WHERE m.status IN ('confirmed', 'pending', 'completed')
      AND (
        m.host_user_id = v_user_id
        OR EXISTS (
          SELECT 1 FROM public.meeting_participants mp2
          WHERE mp2.meeting_id = m.id AND mp2.user_id = v_user_id
        )
      )
      AND m.end_time >= v_now
      AND m.status IN ('confirmed', 'pending')
      ORDER BY m.start_time ASC
    ) sub;
  ELSE
    SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'start_time')::timestamptz DESC), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
      'id', m.id,
      'host_user_id', m.host_user_id,
      'event_type_id', m.event_type_id,
      'title', m.title,
      'description', m.description,
      'start_time', m.start_time,
      'end_time', m.end_time,
      'timezone', m.timezone,
      'location_type', m.location_type,
      'location', m.location,
      'status', m.status,
      'event_types', (
        SELECT jsonb_build_object(
          'name', et.name,
          'location_type', et.location_type,
          'location', et.location
        )
        FROM public.event_types et
        WHERE et.id = m.event_type_id
      ),
      'participants', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'name', COALESCE(
            NULLIF(TRIM(mp.name), ''),
            CASE WHEN mp.is_host AND mp.user_id IS NOT NULL
              THEN public.get_user_display_name(mp.user_id)
              ELSE 'Guest' END
          ),
          'email', mp.email,
          'is_host', mp.is_host
        ))
         FROM public.meeting_participants mp
         WHERE mp.meeting_id = m.id),
        '[]'::JSONB
      )
    ) AS row
    FROM public.meetings m
    WHERE m.status IN ('confirmed', 'completed')
      AND (
        m.host_user_id = v_user_id
        OR EXISTS (
          SELECT 1 FROM public.meeting_participants mp2
          WHERE mp2.meeting_id = m.id AND mp2.user_id = v_user_id
        )
      )
      AND m.start_time < v_now
    ORDER BY m.start_time DESC
    LIMIT 20
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_meetings(BOOLEAN) TO authenticated;
