-- Create recurring weekly meetings for an event type (regular or group)
-- SAFETY: Only creates 4 weeks (1 month) at a time. Schedule is persisted for auto-renewal via replenish_recurring_meetings.
-- Uses host's email as internal participant for "manual" recurring meetings

-- Drop existing overloads so schema cache picks up the new signature
DROP FUNCTION IF EXISTS public.create_recurring_meetings(INTEGER, TEXT, UUID, UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.create_recurring_meetings(INTEGER, TEXT, UUID, UUID, INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.create_recurring_meetings(INTEGER, TEXT, UUID, UUID, INTEGER, TEXT, INTEGER, DATE);

CREATE OR REPLACE FUNCTION public.create_recurring_meetings(
  p_day_of_week INTEGER,  -- 0=Sunday, 1=Monday, ..., 6=Saturday (required)
  p_start_time TEXT,     -- e.g. '09:00' or '14:30' (required)
  p_event_type_id UUID DEFAULT NULL,
  p_group_event_type_id UUID DEFAULT NULL,
  p_weeks_ahead INTEGER DEFAULT 4,  -- Ignored: always capped at 4 for stability
  p_timezone TEXT DEFAULT 'UTC',
  p_interval_weeks INTEGER DEFAULT 1,  -- 1=weekly, 2=bi-weekly, etc.
  p_first_occurrence_date DATE DEFAULT NULL  -- when set, first meeting is on this date (user's chosen start date)
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_host_user_id UUID;
  v_host_email TEXT;
  v_host_name TEXT;
  v_is_group BOOLEAN;
  v_schedule_id UUID;
  v_ref_ts TIMESTAMP;
  v_ref_date DATE;
  v_ref_time TIME;
  v_target_time TIME;
  v_current_dow INTEGER;
  v_days_ahead INTEGER;
  v_first_date DATE;
  v_occurrence_date DATE;
  v_start_timestamptz TIMESTAMPTZ;
  v_result JSONB;
  v_created JSONB := '[]'::JSONB;
  v_failed JSONB := '[]'::JSONB;
  v_i INTEGER;
  v_weeks_to_create INTEGER := 4;  -- Hard cap: 1 month max per run
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF (p_event_type_id IS NULL AND p_group_event_type_id IS NULL) OR
     (p_event_type_id IS NOT NULL AND p_group_event_type_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Provide either event_type_id or group_event_type_id');
  END IF;

  IF p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'day_of_week must be 0-6 (Sun-Sat)');
  END IF;

  IF p_interval_weeks IS NULL OR p_interval_weeks < 1 OR p_interval_weeks > 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'interval_weeks must be 1-4');
  END IF;

  v_is_group := (p_group_event_type_id IS NOT NULL);

  IF v_is_group THEN
    -- Verify user is a host of the group event type
    IF NOT EXISTS (
      SELECT 1 FROM public.group_event_type_hosts
      WHERE group_event_type_id = p_group_event_type_id AND user_id = v_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'You must be a host of this group event type');
    END IF;
    -- Get primary (first) host
    SELECT u.id, au.email, COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', 'Host')
    INTO v_host_user_id, v_host_email, v_host_name
    FROM public.group_event_type_hosts geth
    JOIN public.users u ON u.id = geth.user_id
    CROSS JOIN LATERAL (SELECT email, raw_user_meta_data FROM auth.users WHERE id = geth.user_id) au
    WHERE geth.group_event_type_id = p_group_event_type_id
    ORDER BY geth.created_at
    LIMIT 1;
    IF v_host_email IS NULL THEN
      SELECT email INTO v_host_email FROM auth.users WHERE id = v_host_user_id;
    END IF;
  ELSE
    -- Regular event type: verify user is owner
    SELECT et.user_id INTO v_host_user_id
    FROM public.event_types et
    WHERE et.id = p_event_type_id AND et.is_active = true AND et.user_id = v_user_id;
    IF v_host_user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Event type not found or access denied');
    END IF;
    SELECT email, COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', 'Host')
    INTO v_host_email, v_host_name
    FROM auth.users
    WHERE id = v_host_user_id;
  END IF;

  IF v_host_email IS NULL OR TRIM(v_host_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Host email not found');
  END IF;

  -- Parse start time (accepts HH:MM or HH:MM:SS)
  BEGIN
    v_target_time := p_start_time::TIME;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid start_time format. Use HH:MM or HH:MM:SS');
  END;

  -- Create recurring schedule (persisted for auto-renewal)
  INSERT INTO public.recurring_meeting_schedules (
    event_type_id, group_event_type_id, day_of_week, start_time, interval_weeks, timezone, created_by_user_id, is_active
  ) VALUES (
    p_event_type_id, p_group_event_type_id, p_day_of_week, v_target_time, p_interval_weeks, p_timezone, v_user_id, true
  )
  RETURNING id INTO v_schedule_id;

  -- First occurrence: use user-selected date when provided, otherwise next occurrence of day_of_week from today
  IF p_first_occurrence_date IS NOT NULL THEN
    v_ref_date := (NOW() AT TIME ZONE p_timezone)::DATE;
    IF p_first_occurrence_date < v_ref_date THEN
      RETURN jsonb_build_object('success', false, 'error', 'Start date cannot be in the past');
    END IF;
    v_first_date := p_first_occurrence_date;
  ELSE
    v_ref_ts := NOW() AT TIME ZONE p_timezone;
    v_ref_date := v_ref_ts::DATE;
    v_ref_time := v_ref_ts::TIME;
    v_current_dow := EXTRACT(DOW FROM v_ref_date)::INTEGER;
    v_days_ahead := (p_day_of_week - v_current_dow + 7) % 7;
    IF v_days_ahead = 0 AND v_ref_time >= v_target_time THEN
      v_days_ahead := 7;
    END IF;
    v_first_date := v_ref_date + (v_days_ahead || ' days')::INTERVAL;
  END IF;

  -- Create at most 4 occurrences (1 month cap for DB stability)
  FOR v_i IN 0..(v_weeks_to_create - 1) LOOP
    v_occurrence_date := v_first_date + (v_i * p_interval_weeks * 7 || ' days')::INTERVAL;
    v_start_timestamptz := (v_occurrence_date::TEXT || ' ' || v_target_time::TEXT)::TIMESTAMP AT TIME ZONE p_timezone;

    IF v_is_group THEN
      SELECT * INTO v_result FROM public.book_group_meeting(
        p_group_event_type_id,
        v_start_timestamptz,
        v_host_name,
        v_host_email,
        NULL,
        v_schedule_id
      );
    ELSE
      SELECT * INTO v_result FROM public.book_meeting(
        p_event_type_id,
        v_host_user_id,
        v_start_timestamptz,
        v_host_name,
        v_host_email,
        NULL,
        NULL,
        v_schedule_id
      );
    END IF;

    IF (v_result->>'success')::BOOLEAN THEN
      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'meeting_id', v_result->'meeting_id',
        'start_time', v_result->'start_time',
        'end_time', v_result->'end_time'
      ));
    ELSE
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'start_time', to_char(v_start_timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'error', v_result->>'error'
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'schedule_id', v_schedule_id,
    'created', v_created,
    'failed', v_failed,
    'created_count', jsonb_array_length(v_created),
    'failed_count', jsonb_array_length(v_failed),
    'message', 'Created up to 4 weeks. Next month will be auto-created when replenish job runs.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_recurring_meetings(INTEGER, TEXT, UUID, UUID, INTEGER, TEXT, INTEGER, DATE) TO authenticated;
