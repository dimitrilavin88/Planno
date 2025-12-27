-- Function to book a group meeting
-- Creates meeting and participants for all hosts

CREATE OR REPLACE FUNCTION public.book_group_meeting(
  p_group_event_type_id UUID,
  p_start_time TIMESTAMPTZ,
  p_participant_name TEXT,
  p_participant_email TEXT,
  p_participant_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_group_event_type RECORD;
  v_host RECORD;
  v_duration_minutes INTEGER;
  v_end_time TIMESTAMPTZ;
  v_meeting_id UUID;
  v_has_conflict BOOLEAN;
  v_host_email TEXT;
  v_participant_is_host BOOLEAN := false;
BEGIN
  -- Get group event type details
  SELECT *
  INTO v_group_event_type
  FROM public.group_event_types
  WHERE id = p_group_event_type_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Group event type not found or inactive'
    );
  END IF;

  -- Calculate end time
  v_duration_minutes := v_group_event_type.duration_minutes;
  v_end_time := p_start_time + (v_duration_minutes || ' minutes')::INTERVAL;

  -- Validate minimum notice
  IF p_start_time < NOW() + (v_group_event_type.minimum_notice_hours || ' hours')::INTERVAL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Booking is too soon. Minimum notice required'
    );
  END IF;

  -- Check for conflicts with ALL hosts
  FOR v_host IN
    SELECT u.*
    FROM public.group_event_type_hosts geth
    JOIN public.users u ON u.id = geth.user_id
    WHERE geth.group_event_type_id = p_group_event_type_id
  LOOP
    -- Check for conflicts
    SELECT EXISTS (
      SELECT 1
      FROM public.meetings
      WHERE host_user_id = v_host.id
        AND status IN ('confirmed', 'pending')
        AND (start_time < v_end_time AND end_time > p_start_time)
      FOR UPDATE
    ) INTO v_has_conflict;

    IF v_has_conflict THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Time slot conflicts with ' || v_host.username || '''s schedule'
      );
    END IF;
  END LOOP;

  -- Get first host as primary host
  SELECT u.*
  INTO v_host
  FROM public.group_event_type_hosts geth
  JOIN public.users u ON u.id = geth.user_id
  WHERE geth.group_event_type_id = p_group_event_type_id
  ORDER BY geth.created_at
  LIMIT 1;

  -- Create the meeting (using first host as primary)
  INSERT INTO public.meetings (
    event_type_id, -- NULL for group events
    host_user_id,  -- Primary host
    title,
    description,
    start_time,
    end_time,
    timezone,
    location_type,
    location,
    status
  ) VALUES (
    NULL,
    v_host.id,
    v_group_event_type.name,
    v_group_event_type.description,
    p_start_time,
    v_end_time,
    v_host.timezone,
    v_group_event_type.location_type,
    v_group_event_type.location,
    'confirmed'
  ) RETURNING id INTO v_meeting_id;

  -- Create participants for all hosts
  FOR v_host IN
    SELECT u.*
    FROM public.group_event_type_hosts geth
    JOIN public.users u ON u.id = geth.user_id
    WHERE geth.group_event_type_id = p_group_event_type_id
  LOOP
    -- Get host email
    SELECT email INTO v_host_email
    FROM auth.users
    WHERE id = v_host.id;

    -- Check if participant email matches this host email (case-insensitive)
    IF v_host_email IS NOT NULL AND 
       LOWER(TRIM(COALESCE(p_participant_email, ''))) = LOWER(TRIM(v_host_email)) THEN
      v_participant_is_host := true;
    END IF;

    -- Insert host participant using ON CONFLICT to handle duplicates
    IF v_host_email IS NOT NULL THEN
    INSERT INTO public.meeting_participants (
      meeting_id,
      user_id,
      name,
      email,
      is_host,
      status
    ) VALUES (
      v_meeting_id,
      v_host.id,
      COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = v_host.id), 'Host'),
        LOWER(TRIM(v_host_email)),
      true,
      'accepted'
      )
      ON CONFLICT (meeting_id, email) DO UPDATE
      SET is_host = true,
          status = 'accepted';
    END IF;
  END LOOP;

  -- Create guest participant only if email doesn't match any host
  -- This prevents duplicate key violation when participant is also a host
  IF NOT v_participant_is_host AND TRIM(COALESCE(p_participant_email, '')) != '' THEN
  INSERT INTO public.meeting_participants (
    meeting_id,
    user_id, -- NULL for guests
    name,
    email,
    is_host,
    status
  ) VALUES (
    v_meeting_id,
    NULL, -- Guests don't have user_id
    TRIM(COALESCE(p_participant_name, 'Guest')), -- Trim and ensure name is not empty
    LOWER(TRIM(p_participant_email)),
    false, -- CRITICAL: Guest participants MUST be is_host = false
    'accepted'
    )
    ON CONFLICT (meeting_id, email) DO UPDATE
    SET 
      name = CASE 
        WHEN TRIM(COALESCE(p_participant_name, '')) != '' THEN TRIM(p_participant_name)
        ELSE meeting_participants.name
      END, -- Always use name from form if provided
      is_host = false, -- CRITICAL: Force is_host = false for guest participants
      status = 'accepted',
      user_id = NULL; -- Ensure guest has no user_id
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'meeting_id', v_meeting_id,
    'start_time', p_start_time,
    'end_time', v_end_time
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An error occurred while booking: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.book_group_meeting(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_group_meeting(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO anon;

