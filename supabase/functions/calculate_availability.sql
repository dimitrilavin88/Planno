-- Function to calculate available time slots for an event type
-- This function considers:
-- - Weekly availability rules
-- - Existing meetings
-- - Buffers before/after
-- - Minimum notice period
-- - Daily limits
-- - Timezone conversions

CREATE OR REPLACE FUNCTION public.calculate_availability(
  p_event_type_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  slot_start_local TIMESTAMP,
  slot_end_local TIMESTAMP
) AS $$
DECLARE
  v_event_type RECORD;
  v_user RECORD;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_availability_rule RECORD;
  v_slot_start TIME;
  v_slot_end TIME;
  v_utc_slot_start TIMESTAMPTZ;
  v_utc_slot_end TIMESTAMPTZ;
  v_meeting RECORD;
  v_has_conflict BOOLEAN;
  v_daily_count INTEGER;
  v_ref_date DATE;
  v_weeks_since INTEGER;
  v_interval_weeks INTEGER;
BEGIN
  -- Get event type and user information
  SELECT
    et.*,
    u.id as user_id,
    u.timezone as user_timezone
  INTO v_event_type
  FROM public.event_types et
  JOIN public.users u ON u.id = et.user_id
  WHERE et.id = p_event_type_id
    AND et.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event type not found or inactive';
  END IF;

  -- Loop through each day in the date range
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0 = Sunday, 6 = Saturday

    -- Get availability rules for this day of week
    FOR v_availability_rule IN
      SELECT *
      FROM public.availability_rules
      WHERE user_id = v_event_type.user_id
        AND day_of_week = v_day_of_week
        AND is_available = true
      ORDER BY start_time
    LOOP
      -- Recurrence interval: only include this date if it falls on the right week (every week, every other week, or every 4 weeks)
      v_interval_weeks := COALESCE(v_availability_rule.interval_weeks, 1);
      IF v_interval_weeks > 1 THEN
        v_ref_date := COALESCE(v_availability_rule.interval_start_date, (v_availability_rule.created_at AT TIME ZONE 'UTC')::DATE);
        v_weeks_since := (v_current_date - v_ref_date) / 7;
        IF v_weeks_since < 0 OR (v_weeks_since % v_interval_weeks) != 0 THEN
          CONTINUE;  -- Skip this rule on this date
        END IF;
      END IF;

      -- Calculate slot times in user's timezone
      v_slot_start := v_availability_rule.start_time;
      v_slot_end := v_availability_rule.end_time;

      -- Create potential slots of event duration
      WHILE v_slot_start + (v_event_type.duration_minutes || ' minutes')::INTERVAL <= v_slot_end LOOP
        -- Calculate UTC timestamps
        -- Convert from user's timezone to UTC
        v_utc_slot_start := (v_current_date + v_slot_start)::TIMESTAMP AT TIME ZONE v_event_type.user_timezone;
        v_utc_slot_end := v_utc_slot_start + (v_event_type.duration_minutes || ' minutes')::INTERVAL;

        -- Check minimum notice (in hours). COALESCE to 0 so same-day slots show when notice is 0.
        IF v_utc_slot_start < NOW() + (COALESCE(v_event_type.minimum_notice_hours, 0) || ' hours')::INTERVAL THEN
          v_slot_start := v_slot_start + '30 minutes'::INTERVAL;
          CONTINUE;
        END IF;

        -- Check for conflicts with existing meetings: host is busy if they are the meeting host OR a participant (e.g. group meeting)
        -- Consider buffers so we don't offer slots that would overlap with buffer time
        v_has_conflict := false;
        FOR v_meeting IN
          SELECT m.*
          FROM public.meetings m
          LEFT JOIN public.meeting_participants mp ON mp.meeting_id = m.id AND mp.user_id = v_event_type.user_id
          WHERE m.status IN ('confirmed', 'pending')
            AND (m.host_user_id = v_event_type.user_id OR mp.user_id IS NOT NULL)
            AND (
              m.start_time < v_utc_slot_end + (v_event_type.buffer_after_minutes || ' minutes')::INTERVAL
              AND m.end_time > v_utc_slot_start - (v_event_type.buffer_before_minutes || ' minutes')::INTERVAL
            )
        LOOP
          v_has_conflict := true;
          EXIT;
        END LOOP;

        -- Check daily limit
        IF v_event_type.daily_limit IS NOT NULL THEN
          SELECT COUNT(*)
          INTO v_daily_count
          FROM public.meetings
          WHERE host_user_id = v_event_type.user_id
            AND event_type_id = p_event_type_id
            AND status IN ('confirmed', 'pending')
            AND DATE(start_time AT TIME ZONE v_event_type.user_timezone) = v_current_date;
          
          IF v_daily_count >= v_event_type.daily_limit THEN
            v_has_conflict := true;
          END IF;
        END IF;

        -- If no conflicts, return this slot
        IF NOT v_has_conflict THEN
          slot_start := v_utc_slot_start;
          slot_end := v_utc_slot_end;
          slot_start_local := (v_utc_slot_start AT TIME ZONE p_timezone)::TIMESTAMP;
          slot_end_local := (v_utc_slot_end AT TIME ZONE p_timezone)::TIMESTAMP;
          RETURN NEXT;
        END IF;

        -- Move to next slot (increment by 30 minutes or event duration, whichever is smaller)
        v_slot_start := v_slot_start + LEAST('30 minutes'::INTERVAL, (v_event_type.duration_minutes || ' minutes')::INTERVAL);
      END LOOP;
    END LOOP;

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_availability(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_availability(UUID, DATE, DATE, TEXT) TO anon;

