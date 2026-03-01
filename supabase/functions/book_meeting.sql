-- Atomic booking function to prevent double-booking
-- This function:
-- 1. Validates availability
-- 2. Locks the time slot
-- 3. Creates the meeting and participants
-- 4. Returns the meeting ID
-- Drop legacy overload to avoid ambiguous resolution with default params
DROP FUNCTION IF EXISTS public.book_meeting(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.book_meeting(
  p_event_type_id UUID,
  p_host_user_id UUID,
  p_start_time TIMESTAMPTZ,
  p_participant_name TEXT,
  p_participant_email TEXT,
  p_participant_phone TEXT DEFAULT NULL,
  p_participant_notes TEXT DEFAULT NULL,
  p_lock_id TEXT DEFAULT NULL,
  p_recurring_schedule_id UUID DEFAULT NULL
  ) RETURNS JSONB AS $$
DECLARE v_event_type RECORD;
  v_user RECORD;
  v_meeting RECORD;
  v_duration_minutes INTEGER;
  v_end_time TIMESTAMPTZ;
  v_meeting_id UUID;
  v_participant_id UUID;
  v_lock_expires_at TIMESTAMPTZ;
  v_has_conflict BOOLEAN;
  v_daily_count INTEGER;
  v_host_email TEXT;
  v_bucket_key TEXT;
BEGIN -- Start transaction (function runs in transaction automatically)
  -- Get event type and user information
  SELECT et.*,
    u.timezone as user_timezone INTO v_event_type
  FROM public.event_types et
  JOIN public.users u ON u.id = et.user_id
  WHERE et.id = p_event_type_id
    AND et.is_active = true
    AND et.user_id = p_host_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Event type not found, inactive, or access denied'
    );
  END IF;

  -- Rate limit: per user (authenticated) or per anon key (email+event+slot)
  v_bucket_key := CASE
    WHEN auth.uid() IS NOT NULL THEN 'booking:' || auth.uid()::TEXT
    ELSE 'booking:anon:' || md5(LOWER(TRIM(COALESCE(p_participant_email, ''))) || ':' || p_event_type_id::TEXT || ':' || p_start_time::TEXT)
  END;
  IF NOT public.check_rate_limit(v_bucket_key, 10, 60) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many booking attempts. Please try again in a minute.'
    );
  END IF;

  -- Calculate end time
  v_duration_minutes := v_event_type.duration_minutes;
  v_end_time := p_start_time + (v_duration_minutes || ' minutes')::INTERVAL;
  -- Validate minimum notice
IF p_start_time < NOW() + (v_event_type.minimum_notice_hours || ' hours')::INTERVAL THEN RETURN jsonb_build_object(
  'success',
  false,
  'error',
  'Booking is too soon. Minimum notice required: ' || v_event_type.minimum_notice_hours || ' hours'
    );
  END IF;
  -- Check for time slot locks (prevent concurrent bookings)
  v_lock_expires_at := NOW() + INTERVAL '30 seconds';
IF p_lock_id IS NOT NULL THEN -- Check if lock exists and is valid
    IF EXISTS (
  SELECT 1
  FROM public.time_slot_locks
      WHERE user_id = p_host_user_id
        AND event_type_id = p_event_type_id
        AND start_time = p_start_time
        AND end_time = v_end_time
        AND locked_by != p_lock_id
        AND expires_at > NOW()
) THEN RETURN jsonb_build_object(
  'success',
  false,
  'error',
  'This time slot is currently being booked by someone else'
      );
    END IF;
  END IF;
  -- Check for conflicts: host is busy if they are the meeting host OR a participant (e.g. group meeting)
  v_has_conflict := false;
  FOR v_meeting IN
    SELECT m.*
    FROM public.meetings m
    LEFT JOIN public.meeting_participants mp ON mp.meeting_id = m.id AND mp.user_id = p_host_user_id
    WHERE m.status IN ('confirmed', 'pending')
      AND (m.host_user_id = p_host_user_id OR mp.user_id IS NOT NULL)
      AND (
        m.start_time < v_end_time + (v_event_type.buffer_after_minutes || ' minutes')::INTERVAL
        AND m.end_time > p_start_time - (v_event_type.buffer_before_minutes || ' minutes')::INTERVAL
      )
    FOR UPDATE OF m
  LOOP
    v_has_conflict := true;
    EXIT;
  END LOOP;
IF v_has_conflict THEN RETURN jsonb_build_object(
  'success',
  false,
  'error',
  'Time slot is already booked'
    );
  END IF;
  -- Check daily limit
  IF v_event_type.daily_limit IS NOT NULL THEN
SELECT COUNT(*) INTO v_daily_count
    FROM public.meetings
    WHERE host_user_id = p_host_user_id
      AND event_type_id = p_event_type_id
      AND status IN ('confirmed', 'pending')
  AND DATE(
    start_time AT TIME ZONE v_event_type.user_timezone
  ) = DATE(
    p_start_time AT TIME ZONE v_event_type.user_timezone
  );
IF v_daily_count >= v_event_type.daily_limit THEN RETURN jsonb_build_object(
  'success',
  false,
  'error',
  'Daily booking limit reached for this event type'
      );
    END IF;
  END IF;
  -- Create the meeting
  INSERT INTO public.meetings (
    event_type_id,
    host_user_id,
    title,
    description,
    start_time,
    end_time,
    timezone,
    location_type,
    location,
    status,
    recurring_schedule_id
  )
VALUES (
    p_event_type_id,
    p_host_user_id,
    v_event_type.name,
    v_event_type.description,
    p_start_time,
    v_end_time,
    v_event_type.user_timezone,
    v_event_type.location_type,
    v_event_type.location,
    'confirmed',
    p_recurring_schedule_id
  )
RETURNING id INTO v_meeting_id;
  -- Create host participant
  SELECT id INTO v_user
  FROM public.users
  WHERE id = p_host_user_id;
-- Get host email
SELECT email INTO v_host_email
FROM auth.users
WHERE id = p_host_user_id;
-- Ensure we have a host email
IF v_host_email IS NULL THEN RETURN jsonb_build_object(
  'success',
  false,
  'error',
  'Host email not found'
);
END IF;
-- Check if participant email matches host email
-- If they match, we'll update the host participant with the guest's name
-- If they don't match, we'll create separate host and guest participants
IF LOWER(TRIM(COALESCE(p_participant_email, ''))) = LOWER(TRIM(v_host_email))
AND TRIM(COALESCE(p_participant_email, '')) != '' THEN -- Participant is the host - update host participant with the name from the form
INSERT INTO public.meeting_participants (
    meeting_id,
    user_id,
    name,
    email,
    is_host,
    status
  )
VALUES (
    v_meeting_id,
    p_host_user_id,
    TRIM(COALESCE(p_participant_name, 'Host')),
    -- Use the name from the booking form
    LOWER(TRIM(v_host_email)),
    true,
    'accepted'
  ) ON CONFLICT (meeting_id, email) DO
UPDATE
SET is_host = true,
  status = 'accepted',
  name = TRIM(COALESCE(p_participant_name, EXCLUDED.name)) -- Update name from form
RETURNING id INTO v_participant_id;
ELSE -- Participant is different from host - create separate host and guest participants
-- Insert host participant
  INSERT INTO public.meeting_participants (
    meeting_id,
    user_id,
    name,
    email,
    is_host,
    status
  )
VALUES (
    v_meeting_id,
    p_host_user_id,
    COALESCE(
      (
        SELECT raw_user_meta_data->>'name'
        FROM auth.users
        WHERE id = p_host_user_id
      ),
      'Host'
    ),
    LOWER(TRIM(v_host_email)),
    true,
    'accepted'
  ) ON CONFLICT (meeting_id, email) DO
UPDATE
SET is_host = true,
  status = 'accepted'
RETURNING id INTO v_participant_id;
-- Create guest participant only if email is provided and different from host
IF TRIM(COALESCE(p_participant_email, '')) != '' 
   AND LOWER(TRIM(p_participant_email)) != LOWER(TRIM(v_host_email)) THEN
  -- Insert guest participant - explicitly set is_host = false and user_id = NULL
  INSERT INTO public.meeting_participants (
    meeting_id,
    user_id, -- NULL for guests
    name,
    email,
    is_host,
    status
  )
  VALUES (
    v_meeting_id,
    NULL, -- Guests don't have user_id
    TRIM(COALESCE(p_participant_name, 'Guest')),
    LOWER(TRIM(p_participant_email)),
    false, -- CRITICAL: Guest participants MUST be is_host = false
    'accepted'
  ) ON CONFLICT (meeting_id, email) DO
  UPDATE
  SET 
    name = CASE
      WHEN TRIM(COALESCE(p_participant_name, '')) != '' THEN TRIM(p_participant_name)
      ELSE meeting_participants.name
    END,
    is_host = false, -- CRITICAL: Force is_host = false (never allow true for guest participants)
    status = 'accepted',
    user_id = NULL; -- Ensure guest has no user_id
END IF;
END IF;
  -- Remove the time slot lock if it exists
  IF p_lock_id IS NOT NULL THEN
    DELETE FROM public.time_slot_locks
    WHERE locked_by = p_lock_id;
  END IF;

  -- Create SMS reminder record if a phone number was provided
  IF TRIM(COALESCE(p_participant_phone, '')) <> '' THEN
    INSERT INTO public.reminders (
      booking_id,
      phone_number,
      scheduled_for,
      status
    )
    VALUES (
      v_meeting_id,
      TRIM(p_participant_phone),
      p_start_time - INTERVAL '15 minutes',
      'pending'
    );
  END IF;

  -- Audit: booking created
  INSERT INTO public.workflow_audit_log (event_type, actor_user_id, resource_type, resource_id, action, details)
  VALUES (
    'booking_created',
    p_host_user_id,
    'meeting',
    v_meeting_id,
    'created',
    jsonb_build_object(
      'host_user_id', p_host_user_id,
      'event_type_id', p_event_type_id,
      'start_time', p_start_time,
      'end_time', v_end_time
    )
  );

  -- Return success with meeting ID
  RETURN jsonb_build_object(
  'success',
  true,
  'meeting_id',
  v_meeting_id,
  'start_time',
  p_start_time,
  'end_time',
  v_end_time
  );
EXCEPTION
WHEN OTHERS THEN -- Remove lock on error
    IF p_lock_id IS NOT NULL THEN
DELETE FROM public.time_slot_locks
WHERE locked_by = p_lock_id;
    END IF;
    RETURN jsonb_build_object(
  'success',
  false,
  'error',
  'An error occurred while booking: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.book_meeting(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_meeting(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon;