-- Function to calculate available time slots for a group event type
-- Returns only overlapping availability across all hosts

CREATE OR REPLACE FUNCTION public.calculate_group_availability(
  p_group_event_type_id UUID,
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
  v_group_event_type RECORD;
  v_host RECORD;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_availability_rule RECORD;
  v_slot_start TIME;
  v_slot_end TIME;
  v_utc_slot_start TIMESTAMPTZ;
  v_utc_slot_end TIMESTAMPTZ;
  v_all_hosts_slots JSONB;
  v_host_slots JSONB;
  v_common_slots JSONB;
  v_slot JSONB;
BEGIN
  -- Get group event type details
  SELECT *
  INTO v_group_event_type
  FROM public.group_event_types
  WHERE id = p_group_event_type_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group event type not found or inactive';
  END IF;

  -- Store slots for all hosts (keyed by UTC timestamp)
  v_all_hosts_slots := '{}'::JSONB;

  -- Loop through each host
  FOR v_host IN
    SELECT u.*
    FROM public.group_event_type_hosts geth
    JOIN public.users u ON u.id = geth.user_id
    WHERE geth.group_event_type_id = p_group_event_type_id
  LOOP
    v_host_slots := '[]'::JSONB;

    -- Calculate slots for this host
    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
      v_day_of_week := EXTRACT(DOW FROM v_current_date);

      -- Get availability rules for this day
      FOR v_availability_rule IN
        SELECT *
        FROM public.availability_rules
        WHERE user_id = v_host.id
          AND day_of_week = v_day_of_week
          AND is_available = true
        ORDER BY start_time
      LOOP
        v_slot_start := v_availability_rule.start_time;
        v_slot_end := v_availability_rule.end_time;

        -- Create slots of event duration
        WHILE v_slot_start + (v_group_event_type.duration_minutes || ' minutes')::INTERVAL <= v_slot_end LOOP
          v_utc_slot_start := (v_current_date + v_slot_start)::TIMESTAMP AT TIME ZONE v_host.timezone;
          v_utc_slot_end := v_utc_slot_start + (v_group_event_type.duration_minutes || ' minutes')::INTERVAL;

          -- Check minimum notice
          IF v_utc_slot_start >= NOW() + (v_group_event_type.minimum_notice_hours || ' hours')::INTERVAL THEN
            -- Check for conflicts with existing meetings
            IF NOT EXISTS (
              SELECT 1
              FROM public.meetings
              WHERE host_user_id = v_host.id
                AND status IN ('confirmed', 'pending')
                AND (start_time < v_utc_slot_end AND end_time > v_utc_slot_start)
            ) THEN
              -- Add to host slots
              v_host_slots := v_host_slots || jsonb_build_array(
                jsonb_build_object(
                  'start', v_utc_slot_start,
                  'end', v_utc_slot_end
                )
              );
            END IF;
          END IF;

          v_slot_start := v_slot_start + '30 minutes'::INTERVAL;
        END LOOP;
      END LOOP;

      v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;

    -- Intersect with existing slots
    IF v_all_hosts_slots = '{}'::JSONB THEN
      -- First host - use all their slots
      v_all_hosts_slots := v_host_slots;
    ELSE
      -- Find overlapping slots
      v_common_slots := '[]'::JSONB;
      FOR v_slot IN SELECT * FROM jsonb_array_elements(v_host_slots)
      LOOP
        -- Check if this slot overlaps with any slot in v_all_hosts_slots
        IF EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_all_hosts_slots) existing_slot
          WHERE (existing_slot->>'start')::TIMESTAMPTZ < (v_slot->>'end')::TIMESTAMPTZ
            AND (existing_slot->>'end')::TIMESTAMPTZ > (v_slot->>'start')::TIMESTAMPTZ
        ) THEN
          v_common_slots := v_common_slots || v_slot;
        END IF;
      END LOOP;
      v_all_hosts_slots := v_common_slots;
    END IF;
  END LOOP;

  -- Return common slots
  FOR v_slot IN SELECT * FROM jsonb_array_elements(v_all_hosts_slots)
  LOOP
    slot_start := (v_slot->>'start')::TIMESTAMPTZ;
    slot_end := (v_slot->>'end')::TIMESTAMPTZ;
    slot_start_local := (slot_start AT TIME ZONE p_timezone)::TIMESTAMP;
    slot_end_local := (slot_end AT TIME ZONE p_timezone)::TIMESTAMP;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.calculate_group_availability(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_group_availability(UUID, DATE, DATE, TEXT) TO anon;

