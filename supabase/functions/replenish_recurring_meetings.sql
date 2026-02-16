-- Replenish recurring meetings: creates next month's meetings when running low
-- Run this via pg_cron (e.g. weekly). Only creates up to 4 weeks per schedule per run.
-- Call with: SELECT replenish_recurring_meetings();
CREATE OR REPLACE FUNCTION public.replenish_recurring_meetings()
RETURNS JSONB AS $$
DECLARE
  v_schedule RECORD;
  v_host_user_id UUID;
  v_host_email TEXT;
  v_host_name TEXT;
  v_is_group BOOLEAN;
  v_last_end TIMESTAMPTZ;
  v_first_date DATE;
  v_occurrence_date DATE;
  v_start_timestamptz TIMESTAMPTZ;
  v_result JSONB;
  v_created INTEGER := 0;
  v_failed INTEGER := 0;
  v_i INTEGER;
  v_weeks_to_create INTEGER := 4;
  v_ref_ts TIMESTAMP;
  v_current_dow INTEGER;
  v_days_ahead INTEGER;
  v_ref_time TIME;
  v_total_schedules INTEGER := 0;
BEGIN
  FOR v_schedule IN
    SELECT rms.*
    FROM public.recurring_meeting_schedules rms
    WHERE rms.is_active = true
      AND (
        (rms.event_type_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.event_types et
          WHERE et.id = rms.event_type_id AND et.is_active = true
        ))
        OR
        (rms.group_event_type_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_event_types get
          WHERE get.id = rms.group_event_type_id AND get.is_active = true
        ))
      )
  LOOP
    v_total_schedules := v_total_schedules + 1;
    v_is_group := (v_schedule.group_event_type_id IS NOT NULL);

    -- Get host info
    IF v_is_group THEN
      SELECT u.id, au.email, COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', 'Host')
      INTO v_host_user_id, v_host_email, v_host_name
      FROM public.group_event_type_hosts geth
      JOIN public.users u ON u.id = geth.user_id
      CROSS JOIN LATERAL (SELECT email, raw_user_meta_data FROM auth.users WHERE id = geth.user_id) au
      WHERE geth.group_event_type_id = v_schedule.group_event_type_id
      ORDER BY geth.created_at
      LIMIT 1;
    ELSE
      SELECT et.user_id INTO v_host_user_id
      FROM public.event_types et
      WHERE et.id = v_schedule.event_type_id AND et.is_active = true;
      SELECT email, COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', 'Host')
      INTO v_host_email, v_host_name
      FROM auth.users WHERE id = v_host_user_id;
    END IF;

    IF v_host_email IS NULL OR TRIM(v_host_email) = '' THEN
      v_failed := v_failed + v_weeks_to_create;
      CONTINUE;
    END IF;

    -- Find last meeting start for this schedule
    SELECT MAX(start_time) INTO v_last_end
    FROM public.meetings
    WHERE recurring_schedule_id = v_schedule.id
      AND status IN ('confirmed', 'pending');

    -- First occurrence: interval_weeks after last meeting, or compute from now if no meetings
    IF v_last_end IS NOT NULL AND v_last_end > NOW() THEN
      v_first_date := (v_last_end AT TIME ZONE v_schedule.timezone)::DATE + (COALESCE(v_schedule.interval_weeks, 1) * 7 || ' days')::INTERVAL;
    ELSE
      -- No meetings or past: compute from now
      v_ref_ts := NOW() AT TIME ZONE v_schedule.timezone;
      v_ref_time := v_ref_ts::TIME;
      v_current_dow := EXTRACT(DOW FROM v_ref_ts::DATE)::INTEGER;
      v_days_ahead := (v_schedule.day_of_week - v_current_dow + 7) % 7;
      IF v_days_ahead = 0 AND v_ref_time >= v_schedule.start_time THEN
        v_days_ahead := 7;
      END IF;
      v_first_date := (v_ref_ts::DATE) + (v_days_ahead || ' days')::INTERVAL;
    END IF;

    -- Only create if we don't have enough meetings ahead (less than 2 weeks of coverage)
    IF v_last_end IS NOT NULL AND v_last_end > NOW() + INTERVAL '2 weeks' THEN
      CONTINUE;  -- Already have enough
    END IF;

    -- Create up to 4 occurrences (respecting interval_weeks)
    FOR v_i IN 0..(v_weeks_to_create - 1) LOOP
      v_occurrence_date := v_first_date + (v_i * COALESCE(v_schedule.interval_weeks, 1) * 7 || ' days')::INTERVAL;
      v_start_timestamptz := (v_occurrence_date::TEXT || ' ' || v_schedule.start_time::TEXT)::TIMESTAMP AT TIME ZONE v_schedule.timezone;

      -- Skip if in the past
      IF v_start_timestamptz < NOW() THEN
        CONTINUE;
      END IF;

      IF v_is_group THEN
        SELECT * INTO v_result FROM public.book_group_meeting(
          v_schedule.group_event_type_id,
          v_start_timestamptz,
          v_host_name,
          v_host_email,
          NULL,
          v_schedule.id
        );
      ELSE
        SELECT * INTO v_result FROM public.book_meeting(
          v_schedule.event_type_id,
          v_host_user_id,
          v_start_timestamptz,
          v_host_name,
          v_host_email,
          NULL,
          NULL,
          v_schedule.id
        );
      END IF;

      IF (v_result->>'success')::BOOLEAN THEN
        v_created := v_created + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'schedules_processed', v_total_schedules,
    'meetings_created', v_created,
    'meetings_failed', v_failed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service_role / cron should call this (no grant to authenticated)
-- pg_cron runs as superuser
COMMENT ON FUNCTION public.replenish_recurring_meetings() IS 'Creates next month of recurring meetings. Run via pg_cron weekly.';
