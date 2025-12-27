-- ============================================
-- PLANNO DATABASE SETUP - COMPLETE SQL (FIXED)
-- ============================================
-- Run this file in your Supabase SQL Editor
-- All permission issues have been fixed
-- Updated with duplicate email handling fixes
-- FIXED: Participant names now properly saved from booking form
-- FIXED: Guest participants always have is_host = false
-- ============================================
-- Grant necessary permissions to access auth.users in SECURITY DEFINER functions
GRANT USAGE ON SCHEMA auth TO postgres,
    service_role;
GRANT SELECT ON auth.users TO postgres,
    service_role;
-- ============================================
-- SECTION 1: SCHEMA (Tables, Indexes, Triggers)
-- ============================================
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable timezone support
SET timezone = 'UTC';
-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Event types table
CREATE TABLE IF NOT EXISTS public.event_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    location_type TEXT NOT NULL CHECK (
        location_type IN ('in_person', 'phone', 'video', 'custom')
    ),
    location TEXT,
    buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
    buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
    minimum_notice_hours INTEGER NOT NULL DEFAULT 24,
    daily_limit INTEGER,
    booking_link TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Availability rules table
CREATE TABLE IF NOT EXISTS public.availability_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (
        day_of_week >= 0
        AND day_of_week <= 6
    ),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);
-- Calendar connections table
CREATE TABLE IF NOT EXISTS public.calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
    calendar_id TEXT NOT NULL,
    calendar_name TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider, calendar_id)
);
-- Meetings table (event_type_id is nullable for group meetings)
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type_id UUID REFERENCES public.event_types(id) ON DELETE RESTRICT,
    host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    location_type TEXT NOT NULL CHECK (
        location_type IN ('in_person', 'phone', 'video', 'custom')
    ),
    location TEXT,
    meeting_link TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (
        status IN ('pending', 'confirmed', 'cancelled', 'completed')
    ),
    calendar_event_id TEXT,
    calendar_provider TEXT CHECK (calendar_provider IN ('google', 'outlook')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_meeting_time CHECK (end_time > start_time)
);
-- Meeting participants table
CREATE TABLE IF NOT EXISTS public.meeting_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE
    SET NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        is_host BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'accepted' CHECK (
            status IN ('pending', 'accepted', 'declined', 'cancelled')
        ),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(meeting_id, email)
);
-- Booking links table
CREATE TABLE IF NOT EXISTS public.booking_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    event_type_id UUID REFERENCES public.event_types(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK (link_type IN ('event_type', 'user', 'group')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Group event types table
CREATE TABLE IF NOT EXISTS public.group_event_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    location_type TEXT NOT NULL CHECK (
        location_type IN ('in_person', 'phone', 'video', 'custom')
    ),
    location TEXT,
    booking_link TEXT UNIQUE NOT NULL,
    minimum_notice_hours INTEGER NOT NULL DEFAULT 24,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Group event type hosts table
CREATE TABLE IF NOT EXISTS public.group_event_type_hosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_event_type_id UUID NOT NULL REFERENCES public.group_event_types(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_event_type_id, user_id)
);
-- Time slot locks table
CREATE TABLE IF NOT EXISTS public.time_slot_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type_id UUID REFERENCES public.event_types(id) ON DELETE CASCADE,
    group_event_type_id UUID REFERENCES public.group_event_types(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    locked_by TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_lock_time CHECK (end_time > start_time),
    CONSTRAINT single_lock_type CHECK (
        (
            event_type_id IS NOT NULL
            AND group_event_type_id IS NULL
        )
        OR (
            event_type_id IS NULL
            AND group_event_type_id IS NOT NULL
        )
    )
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_event_types_user_id ON public.event_types(user_id);
CREATE INDEX IF NOT EXISTS idx_event_types_booking_link ON public.event_types(booking_link);
CREATE INDEX IF NOT EXISTS idx_availability_rules_user_id ON public.availability_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON public.calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_host_user_id ON public.meetings(host_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_event_type_id ON public.meetings(event_type_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON public.meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_email ON public.meeting_participants(email);
CREATE INDEX IF NOT EXISTS idx_booking_links_token ON public.booking_links(token);
CREATE INDEX IF NOT EXISTS idx_time_slot_locks_user_id ON public.time_slot_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_slot_locks_expires_at ON public.time_slot_locks(expires_at);
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ language 'plpgsql';
-- Triggers to automatically update updated_at
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_event_types_updated_at ON public.event_types;
DROP TRIGGER IF EXISTS update_availability_rules_updated_at ON public.availability_rules;
DROP TRIGGER IF EXISTS update_calendars_updated_at ON public.calendars;
DROP TRIGGER IF EXISTS update_meetings_updated_at ON public.meetings;
DROP TRIGGER IF EXISTS update_meeting_participants_updated_at ON public.meeting_participants;
DROP TRIGGER IF EXISTS update_booking_links_updated_at ON public.booking_links;
DROP TRIGGER IF EXISTS update_group_event_types_updated_at ON public.group_event_types;
-- Create triggers
CREATE TRIGGER update_users_updated_at BEFORE
UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_types_updated_at BEFORE
UPDATE ON public.event_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_availability_rules_updated_at BEFORE
UPDATE ON public.availability_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendars_updated_at BEFORE
UPDATE ON public.calendars FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE
UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meeting_participants_updated_at BEFORE
UPDATE ON public.meeting_participants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_booking_links_updated_at BEFORE
UPDATE ON public.booking_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_event_types_updated_at BEFORE
UPDATE ON public.group_event_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================
-- SECTION 2: ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_event_type_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slot_locks ENABLE ROW LEVEL SECURITY;
-- Note: auth.uid() is a built-in Supabase function, use it directly in policies
-- USERS TABLE POLICIES
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Public can read usernames" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR
SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR
UPDATE USING (auth.uid() = id);
CREATE POLICY "Public can read usernames" ON public.users FOR
SELECT USING (true);
-- EVENT TYPES TABLE POLICIES
DROP POLICY IF EXISTS "Users can read own event types" ON public.event_types;
DROP POLICY IF EXISTS "Users can insert own event types" ON public.event_types;
DROP POLICY IF EXISTS "Users can update own event types" ON public.event_types;
DROP POLICY IF EXISTS "Users can delete own event types" ON public.event_types;
DROP POLICY IF EXISTS "Public can read active event types by booking link" ON public.event_types;
CREATE POLICY "Users can read own event types" ON public.event_types FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own event types" ON public.event_types FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own event types" ON public.event_types FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own event types" ON public.event_types FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public can read active event types by booking link" ON public.event_types FOR
SELECT USING (is_active = true);
-- AVAILABILITY RULES TABLE POLICIES
DROP POLICY IF EXISTS "Users can manage own availability rules" ON public.availability_rules;
CREATE POLICY "Users can manage own availability rules" ON public.availability_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CALENDARS TABLE POLICIES
DROP POLICY IF EXISTS "Users can manage own calendars" ON public.calendars;
CREATE POLICY "Users can manage own calendars" ON public.calendars FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- MEETINGS TABLE POLICIES
DROP POLICY IF EXISTS "Hosts can read own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Hosts can update own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Hosts can delete own meetings" ON public.meetings;
CREATE POLICY "Hosts can read own meetings" ON public.meetings FOR
SELECT USING (auth.uid() = host_user_id);
CREATE POLICY "Hosts can update own meetings" ON public.meetings FOR
UPDATE USING (auth.uid() = host_user_id);
CREATE POLICY "Hosts can delete own meetings" ON public.meetings FOR DELETE USING (auth.uid() = host_user_id);
-- MEETING PARTICIPANTS TABLE POLICIES
DROP POLICY IF EXISTS "Participants can read own meetings" ON public.meeting_participants;
DROP POLICY IF EXISTS "Participants can update own status" ON public.meeting_participants;
CREATE POLICY "Participants can read own meetings" ON public.meeting_participants FOR
SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1
            FROM public.meetings m
            WHERE m.id = meeting_id
                AND m.host_user_id = auth.uid()
        )
    );
-- FIXED: Removed auth.users access from RLS policy
CREATE POLICY "Participants can update own status" ON public.meeting_participants FOR
UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- BOOKING LINKS TABLE POLICIES
DROP POLICY IF EXISTS "Users can read own booking links" ON public.booking_links;
DROP POLICY IF EXISTS "Users can manage own booking links" ON public.booking_links;
DROP POLICY IF EXISTS "Public can read active booking links" ON public.booking_links;
CREATE POLICY "Users can read own booking links" ON public.booking_links FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own booking links" ON public.booking_links FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can read active booking links" ON public.booking_links FOR
SELECT USING (
        is_active = true
        AND (
            expires_at IS NULL
            OR expires_at > NOW()
        )
    );
-- GROUP EVENT TYPES TABLE POLICIES
DROP POLICY IF EXISTS "Hosts can read group event types" ON public.group_event_types;
DROP POLICY IF EXISTS "Hosts can insert group event types" ON public.group_event_types;
DROP POLICY IF EXISTS "Hosts can update group event types" ON public.group_event_types;
DROP POLICY IF EXISTS "Hosts can delete group event types" ON public.group_event_types;
DROP POLICY IF EXISTS "Public can read active group event types by booking link" ON public.group_event_types;
CREATE POLICY "Hosts can read group event types" ON public.group_event_types FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.group_event_type_hosts geth
            WHERE geth.group_event_type_id = group_event_types.id
                AND geth.user_id = auth.uid()
        )
    );
CREATE POLICY "Hosts can insert group event types" ON public.group_event_types FOR
INSERT WITH CHECK (true);
CREATE POLICY "Hosts can update group event types" ON public.group_event_types FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.group_event_type_hosts geth
            WHERE geth.group_event_type_id = group_event_types.id
                AND geth.user_id = auth.uid()
        )
    );
CREATE POLICY "Hosts can delete group event types" ON public.group_event_types FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.group_event_type_hosts geth
        WHERE geth.group_event_type_id = group_event_types.id
            AND geth.user_id = auth.uid()
    )
);
CREATE POLICY "Public can read active group event types by booking link" ON public.group_event_types FOR
SELECT USING (is_active = true);
-- GROUP EVENT TYPE HOSTS TABLE POLICIES
DROP POLICY IF EXISTS "Hosts can read group event type hosts" ON public.group_event_type_hosts;
DROP POLICY IF EXISTS "Users can insert group event type hosts" ON public.group_event_type_hosts;
DROP POLICY IF EXISTS "Users can delete own group event type host" ON public.group_event_type_hosts;
CREATE POLICY "Hosts can read group event type hosts" ON public.group_event_type_hosts FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.group_event_type_hosts geth2
            WHERE geth2.group_event_type_id = group_event_type_hosts.group_event_type_id
                AND geth2.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert group event type hosts" ON public.group_event_type_hosts FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own group event type host" ON public.group_event_type_hosts FOR DELETE USING (auth.uid() = user_id);
-- TIME SLOT LOCKS TABLE POLICIES
DROP POLICY IF EXISTS "Service role only for time slot locks" ON public.time_slot_locks;
CREATE POLICY "Service role only for time slot locks" ON public.time_slot_locks FOR ALL USING (false) WITH CHECK (false);
-- ============================================
-- SECTION 3: USER PROFILE FUNCTIONS
-- ============================================
-- Function to create user profile after signup
-- FIXED: Added SECURITY DEFINER and SET search_path
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER SECURITY DEFINER
SET search_path = public AS $$ BEGIN
INSERT INTO public.users (id, username, timezone)
VALUES (
        NEW.id,
        'user_' || substr(NEW.id::text, 1, 8),
        'UTC'
    );
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Function to update username with uniqueness check
-- FIXED: Added SECURITY DEFINER and SET search_path
CREATE OR REPLACE FUNCTION public.update_username(p_user_id UUID, p_username TEXT) RETURNS JSONB SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN IF NOT (p_username ~ '^[a-zA-Z0-9_]{3,30}$') THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Username must be 3-30 characters and contain only letters, numbers, and underscores'
);
END IF;
BEGIN
UPDATE public.users
SET username = LOWER(p_username)
WHERE id = p_user_id;
RETURN jsonb_build_object(
    'success',
    true,
    'username',
    LOWER(p_username)
);
EXCEPTION
WHEN unique_violation THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Username is already taken'
);
WHEN OTHERS THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Failed to update username'
);
END;
END;
$$ LANGUAGE plpgsql;
-- ============================================
-- SECTION 4: HELPER FUNCTION FOR USER EMAIL
-- ============================================
-- This helper function safely retrieves user email using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_user_email(p_user_id UUID) RETURNS TEXT SECURITY DEFINER
SET search_path = public,
    auth AS $$ BEGIN RETURN (
        SELECT email
        FROM auth.users
        WHERE id = p_user_id
    );
EXCEPTION
WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated,
    anon,
    service_role;
-- Helper function to get user display name from auth.users metadata
-- Returns full_name, name, or falls back to username from public.users
CREATE OR REPLACE FUNCTION public.get_user_display_name(p_user_id UUID) RETURNS TEXT SECURITY DEFINER
SET search_path = public,
    auth AS $$
DECLARE v_display_name TEXT;
BEGIN -- Try to get full_name from user metadata
SELECT raw_user_meta_data->>'full_name' INTO v_display_name
FROM auth.users
WHERE id = p_user_id;
-- If full_name is empty, try 'name'
IF v_display_name IS NULL
OR TRIM(v_display_name) = '' THEN
SELECT raw_user_meta_data->>'name' INTO v_display_name
FROM auth.users
WHERE id = p_user_id;
END IF;
-- If still empty, fall back to username from public.users
IF v_display_name IS NULL
OR TRIM(v_display_name) = '' THEN
SELECT username INTO v_display_name
FROM public.users
WHERE id = p_user_id;
END IF;
RETURN COALESCE(v_display_name, 'User');
EXCEPTION
WHEN OTHERS THEN -- Fallback to username if anything fails
SELECT username INTO v_display_name
FROM public.users
WHERE id = p_user_id;
RETURN COALESCE(v_display_name, 'User');
END;
$$ LANGUAGE plpgsql;
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated,
    anon,
    service_role;
-- ============================================
-- SECTION 5: BOOKING FUNCTIONS
-- ============================================
-- Function to calculate available time slots
CREATE OR REPLACE FUNCTION public.calculate_availability(
        p_event_type_id UUID,
        p_start_date DATE,
        p_end_date DATE,
        p_timezone TEXT DEFAULT 'UTC'
    ) RETURNS TABLE (
        slot_start TIMESTAMPTZ,
        slot_end TIMESTAMPTZ,
        slot_start_local TIMESTAMP,
        slot_end_local TIMESTAMP
    ) SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_event_type RECORD;
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
BEGIN
SELECT et.*,
    u.id as user_id,
    u.timezone as user_timezone INTO v_event_type
FROM public.event_types et
    JOIN public.users u ON u.id = et.user_id
WHERE et.id = p_event_type_id
    AND et.is_active = true;
IF NOT FOUND THEN RAISE EXCEPTION 'Event type not found or inactive';
END IF;
v_current_date := p_start_date;
WHILE v_current_date <= p_end_date LOOP v_day_of_week := EXTRACT(
    DOW
    FROM v_current_date
);
FOR v_availability_rule IN
SELECT *
FROM public.availability_rules
WHERE user_id = v_event_type.user_id
    AND day_of_week = v_day_of_week
    AND is_available = true
ORDER BY start_time LOOP v_slot_start := v_availability_rule.start_time;
v_slot_end := v_availability_rule.end_time;
WHILE v_slot_start + (v_event_type.duration_minutes || ' minutes')::INTERVAL <= v_slot_end LOOP v_utc_slot_start := (v_current_date + v_slot_start)::TIMESTAMP AT TIME ZONE v_event_type.user_timezone;
v_utc_slot_end := v_utc_slot_start + (v_event_type.duration_minutes || ' minutes')::INTERVAL;
-- Only apply minimum notice check if the slot is on today's date
-- Future dates should always be available (subject to other constraints)
IF DATE(
    v_utc_slot_start AT TIME ZONE v_event_type.user_timezone
) = DATE(NOW() AT TIME ZONE v_event_type.user_timezone)
AND v_utc_slot_start < NOW() + (v_event_type.minimum_notice_hours || ' hours')::INTERVAL THEN v_slot_start := v_slot_start + '30 minutes'::INTERVAL;
CONTINUE;
END IF;
v_utc_slot_start := v_utc_slot_start - (v_event_type.buffer_before_minutes || ' minutes')::INTERVAL;
v_utc_slot_end := v_utc_slot_end + (v_event_type.buffer_after_minutes || ' minutes')::INTERVAL;
v_has_conflict := false;
FOR v_meeting IN
SELECT *
FROM public.meetings
WHERE host_user_id = v_event_type.user_id
    AND status IN ('confirmed', 'pending')
    AND (
        start_time < v_utc_slot_end
        AND end_time > v_utc_slot_start
    ) LOOP v_has_conflict := true;
EXIT;
END LOOP;
IF v_event_type.daily_limit IS NOT NULL THEN
SELECT COUNT(*) INTO v_daily_count
FROM public.meetings
WHERE host_user_id = v_event_type.user_id
    AND event_type_id = p_event_type_id
    AND status IN ('confirmed', 'pending')
    AND DATE(
        start_time AT TIME ZONE v_event_type.user_timezone
    ) = v_current_date;
IF v_daily_count >= v_event_type.daily_limit THEN v_has_conflict := true;
END IF;
END IF;
IF NOT v_has_conflict THEN slot_start := v_utc_slot_start;
slot_end := v_utc_slot_end;
slot_start_local := (v_utc_slot_start AT TIME ZONE p_timezone)::TIMESTAMP;
slot_end_local := (v_utc_slot_end AT TIME ZONE p_timezone)::TIMESTAMP;
RETURN NEXT;
END IF;
v_slot_start := v_slot_start + LEAST(
    '30 minutes'::INTERVAL,
    (v_event_type.duration_minutes || ' minutes')::INTERVAL
);
END LOOP;
END LOOP;
v_current_date := v_current_date + INTERVAL '1 day';
END LOOP;
RETURN;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.calculate_availability(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_availability(UUID, DATE, DATE, TEXT) TO anon;
-- Function to lock a time slot
CREATE OR REPLACE FUNCTION public.lock_time_slot(
        p_user_id UUID,
        p_event_type_id UUID,
        p_start_time TIMESTAMPTZ,
        p_end_time TIMESTAMPTZ,
        p_lock_id TEXT
    ) RETURNS JSONB SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_expires_at TIMESTAMPTZ;
v_existing_lock RECORD;
BEGIN v_expires_at := NOW() + INTERVAL '30 seconds';
SELECT * INTO v_existing_lock
FROM public.time_slot_locks
WHERE user_id = p_user_id
    AND event_type_id = p_event_type_id
    AND start_time = p_start_time
    AND end_time = p_end_time
    AND expires_at > NOW();
IF FOUND
AND v_existing_lock.locked_by != p_lock_id THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Time slot is currently locked'
);
END IF;
DELETE FROM public.time_slot_locks
WHERE expires_at <= NOW();
INSERT INTO public.time_slot_locks (
        user_id,
        event_type_id,
        start_time,
        end_time,
        locked_by,
        expires_at
    )
VALUES (
        p_user_id,
        p_event_type_id,
        p_start_time,
        p_end_time,
        p_lock_id,
        v_expires_at
    ) ON CONFLICT DO NOTHING;
IF NOT FOUND THEN
UPDATE public.time_slot_locks
SET expires_at = v_expires_at
WHERE user_id = p_user_id
    AND event_type_id = p_event_type_id
    AND start_time = p_start_time
    AND end_time = p_end_time
    AND locked_by = p_lock_id;
END IF;
RETURN jsonb_build_object(
    'success',
    true,
    'expires_at',
    v_expires_at
);
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.lock_time_slot(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_time_slot(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;
-- Atomic booking function to prevent double-booking
-- UPDATED: Fixed duplicate email handling, participant name saving, and is_host for guests
CREATE OR REPLACE FUNCTION public.book_meeting(
        p_event_type_id UUID,
        p_host_user_id UUID,
        p_start_time TIMESTAMPTZ,
        p_participant_name TEXT,
        p_participant_email TEXT,
        p_participant_notes TEXT DEFAULT NULL,
        p_lock_id TEXT DEFAULT NULL
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
BEGIN -- Get event type and user information
SELECT et.*,
    u.timezone as user_timezone INTO v_event_type
FROM public.event_types et
    JOIN public.users u ON u.id = et.user_id
WHERE et.id = p_event_type_id
    AND et.is_active = true
    AND et.user_id = p_host_user_id;
IF NOT FOUND THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Event type not found, inactive, or access denied'
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
-- Check for conflicts with existing meetings (including buffers)
v_has_conflict := false;
FOR v_meeting IN
SELECT *
FROM public.meetings
WHERE host_user_id = p_host_user_id
    AND status IN ('confirmed', 'pending')
    AND (
        -- Overlap check considering buffers
        (
            start_time < v_end_time + (v_event_type.buffer_after_minutes || ' minutes')::INTERVAL
            AND end_time > p_start_time - (v_event_type.buffer_before_minutes || ' minutes')::INTERVAL
        )
    ) FOR
UPDATE -- Lock rows to prevent concurrent modifications
    LOOP v_has_conflict := true;
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
        status
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
        'confirmed'
    )
RETURNING id INTO v_meeting_id;
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
AND LOWER(TRIM(p_participant_email)) != LOWER(TRIM(v_host_email)) THEN -- Insert guest participant - explicitly set is_host = false and user_id = NULL
INSERT INTO public.meeting_participants (
        meeting_id,
        user_id,
        -- NULL for guests
        name,
        email,
        is_host,
        status
    )
VALUES (
        v_meeting_id,
        NULL,
        -- Guests don't have user_id
        TRIM(COALESCE(p_participant_name, 'Guest')),
        LOWER(TRIM(p_participant_email)),
        false,
        -- CRITICAL: Guest participants MUST be is_host = false
        'accepted'
    ) ON CONFLICT (meeting_id, email) DO
UPDATE
SET name = CASE
        WHEN TRIM(COALESCE(p_participant_name, '')) != '' THEN TRIM(p_participant_name)
        ELSE meeting_participants.name
    END,
    is_host = false,
    -- CRITICAL: Force is_host = false (never allow true for guest participants)
    status = 'accepted',
    user_id = NULL;
-- Ensure guest has no user_id
END IF;
END IF;
-- Remove the time slot lock if it exists
IF p_lock_id IS NOT NULL THEN
DELETE FROM public.time_slot_locks
WHERE locked_by = p_lock_id;
END IF;
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
GRANT EXECUTE ON FUNCTION public.book_meeting(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_meeting(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO anon;
-- ============================================
-- SECTION 6: MEETING MANAGEMENT FUNCTIONS
-- ============================================
-- Function to reschedule a meeting
CREATE OR REPLACE FUNCTION public.reschedule_meeting(
        p_meeting_id UUID,
        p_new_start_time TIMESTAMPTZ,
        p_participant_token TEXT DEFAULT NULL
    ) RETURNS JSONB SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_meeting RECORD;
v_new_end_time TIMESTAMPTZ;
v_old_start_time TIMESTAMPTZ;
v_old_end_time TIMESTAMPTZ;
v_has_conflict BOOLEAN;
BEGIN
SELECT m.*,
    et.*,
    u.timezone as user_timezone INTO v_meeting
FROM public.meetings m
    JOIN public.event_types et ON et.id = m.event_type_id
    JOIN public.users u ON u.id = m.host_user_id
WHERE m.id = p_meeting_id
    AND m.status IN ('confirmed', 'pending');
IF NOT FOUND THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Meeting not found or cannot be rescheduled'
);
END IF;
v_new_end_time := p_new_start_time + (v_meeting.duration_minutes || ' minutes')::INTERVAL;
v_old_start_time := v_meeting.start_time;
v_old_end_time := v_meeting.end_time;
IF p_new_start_time < NOW() + (v_meeting.minimum_notice_hours || ' hours')::INTERVAL THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'New time is too soon. Minimum notice required: ' || v_meeting.minimum_notice_hours || ' hours'
);
END IF;
-- Check for conflicts - lock rows first for concurrency safety
PERFORM 1
FROM public.meetings
WHERE host_user_id = v_meeting.host_user_id
    AND id != p_meeting_id
    AND status IN ('confirmed', 'pending')
    AND (
        (
            start_time < v_new_end_time + (v_meeting.buffer_after_minutes || ' minutes')::INTERVAL
            AND end_time > p_new_start_time - (v_meeting.buffer_before_minutes || ' minutes')::INTERVAL
        )
    ) FOR
UPDATE
LIMIT 1;
-- Check if any rows were found (FOUND is set by PERFORM)
v_has_conflict := FOUND;
IF v_has_conflict THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'New time slot conflicts with another meeting'
);
END IF;
UPDATE public.meetings
SET start_time = p_new_start_time,
    end_time = v_new_end_time,
    updated_at = NOW()
WHERE id = p_meeting_id;
RETURN jsonb_build_object(
    'success',
    true,
    'meeting_id',
    p_meeting_id,
    'old_start_time',
    v_old_start_time,
    'new_start_time',
    p_new_start_time,
    'old_end_time',
    v_old_end_time,
    'new_end_time',
    v_new_end_time
);
EXCEPTION
WHEN OTHERS THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'An error occurred while rescheduling: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.reschedule_meeting(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_meeting(UUID, TIMESTAMPTZ, TEXT) TO anon;
-- Function to cancel a meeting
CREATE OR REPLACE FUNCTION public.cancel_meeting(
        p_meeting_id UUID,
        p_participant_token TEXT DEFAULT NULL
    ) RETURNS JSONB SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_meeting RECORD;
BEGIN
SELECT * INTO v_meeting
FROM public.meetings
WHERE id = p_meeting_id
    AND status IN ('confirmed', 'pending');
IF NOT FOUND THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Meeting not found or already cancelled'
);
END IF;
UPDATE public.meetings
SET status = 'cancelled',
    updated_at = NOW()
WHERE id = p_meeting_id;
UPDATE public.meeting_participants
SET status = 'cancelled',
    updated_at = NOW()
WHERE meeting_id = p_meeting_id;
RETURN jsonb_build_object(
    'success',
    true,
    'meeting_id',
    p_meeting_id,
    'cancelled_at',
    NOW()
);
EXCEPTION
WHEN OTHERS THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'An error occurred while cancelling: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.cancel_meeting(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_meeting(UUID, TEXT) TO anon;
-- ============================================
-- SECTION 7: GROUP SCHEDULING FUNCTIONS
-- ============================================
-- Function to calculate group availability
CREATE OR REPLACE FUNCTION public.calculate_group_availability(
        p_group_event_type_id UUID,
        p_start_date DATE,
        p_end_date DATE,
        p_timezone TEXT DEFAULT 'UTC'
    ) RETURNS TABLE (
        slot_start TIMESTAMPTZ,
        slot_end TIMESTAMPTZ,
        slot_start_local TIMESTAMP,
        slot_end_local TIMESTAMP
    ) SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_group_event_type RECORD;
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
SELECT * INTO v_group_event_type
FROM public.group_event_types
WHERE id = p_group_event_type_id
    AND is_active = true;
IF NOT FOUND THEN RAISE EXCEPTION 'Group event type not found or inactive';
END IF;
v_all_hosts_slots := '{}'::JSONB;
FOR v_host IN
SELECT u.*
FROM public.group_event_type_hosts geth
    JOIN public.users u ON u.id = geth.user_id
WHERE geth.group_event_type_id = p_group_event_type_id LOOP v_host_slots := '[]'::JSONB;
v_current_date := p_start_date;
WHILE v_current_date <= p_end_date LOOP v_day_of_week := EXTRACT(
    DOW
    FROM v_current_date
);
FOR v_availability_rule IN
SELECT *
FROM public.availability_rules
WHERE user_id = v_host.id
    AND day_of_week = v_day_of_week
    AND is_available = true
ORDER BY start_time LOOP v_slot_start := v_availability_rule.start_time;
v_slot_end := v_availability_rule.end_time;
WHILE v_slot_start + (
    v_group_event_type.duration_minutes || ' minutes'
)::INTERVAL <= v_slot_end LOOP v_utc_slot_start := (v_current_date + v_slot_start)::TIMESTAMP AT TIME ZONE v_host.timezone;
v_utc_slot_end := v_utc_slot_start + (
    v_group_event_type.duration_minutes || ' minutes'
)::INTERVAL;
-- Only apply minimum notice check if the slot is on today's date
-- Future dates should always be available (subject to other constraints)
IF (
    DATE(v_utc_slot_start AT TIME ZONE v_host.timezone) = DATE(NOW() AT TIME ZONE v_host.timezone)
    AND v_utc_slot_start >= NOW() + (
        v_group_event_type.minimum_notice_hours || ' hours'
    )::INTERVAL
)
OR DATE(v_utc_slot_start AT TIME ZONE v_host.timezone) > DATE(NOW() AT TIME ZONE v_host.timezone) THEN IF NOT EXISTS (
    SELECT 1
    FROM public.meetings
    WHERE host_user_id = v_host.id
        AND status IN ('confirmed', 'pending')
        AND (
            start_time < v_utc_slot_end
            AND end_time > v_utc_slot_start
        )
) THEN v_host_slots := v_host_slots || jsonb_build_array(
    jsonb_build_object(
        'start',
        v_utc_slot_start,
        'end',
        v_utc_slot_end
    )
);
END IF;
END IF;
v_slot_start := v_slot_start + '30 minutes'::INTERVAL;
END LOOP;
END LOOP;
v_current_date := v_current_date + INTERVAL '1 day';
END LOOP;
IF v_all_hosts_slots = '{}'::JSONB THEN v_all_hosts_slots := v_host_slots;
ELSE v_common_slots := '[]'::JSONB;
FOR v_slot IN
SELECT *
FROM jsonb_array_elements(v_host_slots) LOOP IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_all_hosts_slots) existing_slot
        WHERE (existing_slot->>'start')::TIMESTAMPTZ < (v_slot->>'end')::TIMESTAMPTZ
            AND (existing_slot->>'end')::TIMESTAMPTZ > (v_slot->>'start')::TIMESTAMPTZ
    ) THEN v_common_slots := v_common_slots || v_slot;
END IF;
END LOOP;
v_all_hosts_slots := v_common_slots;
END IF;
END LOOP;
FOR v_slot IN
SELECT *
FROM jsonb_array_elements(v_all_hosts_slots) LOOP slot_start := (v_slot->>'start')::TIMESTAMPTZ;
slot_end := (v_slot->>'end')::TIMESTAMPTZ;
slot_start_local := (slot_start AT TIME ZONE p_timezone)::TIMESTAMP;
slot_end_local := (slot_end AT TIME ZONE p_timezone)::TIMESTAMP;
RETURN NEXT;
END LOOP;
RETURN;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.calculate_group_availability(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_group_availability(UUID, DATE, DATE, TEXT) TO anon;
-- Function to book a group meeting
-- UPDATED: Fixed duplicate email handling, participant name saving, and is_host for guests
CREATE OR REPLACE FUNCTION public.book_group_meeting(
        p_group_event_type_id UUID,
        p_start_time TIMESTAMPTZ,
        p_participant_name TEXT,
        p_participant_email TEXT,
        p_participant_notes TEXT DEFAULT NULL
    ) RETURNS JSONB AS $$
DECLARE v_group_event_type RECORD;
v_host RECORD;
v_duration_minutes INTEGER;
v_end_time TIMESTAMPTZ;
v_meeting_id UUID;
v_has_conflict BOOLEAN;
v_host_email TEXT;
v_participant_is_host BOOLEAN := false;
BEGIN -- Get group event type details
SELECT * INTO v_group_event_type
FROM public.group_event_types
WHERE id = p_group_event_type_id
    AND is_active = true;
IF NOT FOUND THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Group event type not found or inactive'
);
END IF;
-- Calculate end time
v_duration_minutes := v_group_event_type.duration_minutes;
v_end_time := p_start_time + (v_duration_minutes || ' minutes')::INTERVAL;
-- Validate minimum notice
IF p_start_time < NOW() + (
    v_group_event_type.minimum_notice_hours || ' hours'
)::INTERVAL THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Booking is too soon. Minimum notice required'
);
END IF;
-- Check for conflicts with ALL hosts
FOR v_host IN
SELECT u.*
FROM public.group_event_type_hosts geth
    JOIN public.users u ON u.id = geth.user_id
WHERE geth.group_event_type_id = p_group_event_type_id LOOP -- Check for conflicts
SELECT EXISTS (
        SELECT 1
        FROM public.meetings
        WHERE host_user_id = v_host.id
            AND status IN ('confirmed', 'pending')
            AND (
                start_time < v_end_time
                AND end_time > p_start_time
            ) FOR
        UPDATE
    ) INTO v_has_conflict;
IF v_has_conflict THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Time slot conflicts with ' || v_host.username || '''s schedule'
);
END IF;
END LOOP;
-- Get first host as primary host
SELECT u.* INTO v_host
FROM public.group_event_type_hosts geth
    JOIN public.users u ON u.id = geth.user_id
WHERE geth.group_event_type_id = p_group_event_type_id
ORDER BY geth.created_at
LIMIT 1;
-- Create the meeting (using first host as primary)
INSERT INTO public.meetings (
        event_type_id,
        -- NULL for group events
        host_user_id,
        -- Primary host
        title,
        description,
        start_time,
        end_time,
        timezone,
        location_type,
        location,
        status
    )
VALUES (
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
    )
RETURNING id INTO v_meeting_id;
-- Create participants for all hosts
FOR v_host IN
SELECT u.*
FROM public.group_event_type_hosts geth
    JOIN public.users u ON u.id = geth.user_id
WHERE geth.group_event_type_id = p_group_event_type_id LOOP -- Get host email
SELECT email INTO v_host_email
FROM auth.users
WHERE id = v_host.id;
-- Check if participant email matches this host email (case-insensitive)
IF v_host_email IS NOT NULL
AND LOWER(TRIM(COALESCE(p_participant_email, ''))) = LOWER(TRIM(v_host_email)) THEN v_participant_is_host := true;
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
    )
VALUES (
        v_meeting_id,
        v_host.id,
        COALESCE(
            (
                SELECT raw_user_meta_data->>'name'
                FROM auth.users
                WHERE id = v_host.id
            ),
            'Host'
        ),
        LOWER(TRIM(v_host_email)),
        true,
        'accepted'
    ) ON CONFLICT (meeting_id, email) DO
UPDATE
SET is_host = true,
    status = 'accepted';
END IF;
END LOOP;
-- Create guest participant only if email doesn't match any host
-- This prevents duplicate key violation when participant is also a host
IF NOT v_participant_is_host
AND TRIM(COALESCE(p_participant_email, '')) != '' THEN -- Insert guest participant - explicitly set is_host = false and user_id = NULL
INSERT INTO public.meeting_participants (
        meeting_id,
        user_id,
        -- NULL for guests
        name,
        email,
        is_host,
        status
    )
VALUES (
        v_meeting_id,
        NULL,
        -- Guests don't have user_id
        TRIM(COALESCE(p_participant_name, 'Guest')),
        LOWER(TRIM(p_participant_email)),
        false,
        -- CRITICAL: Guest participants MUST be is_host = false
        'accepted'
    ) ON CONFLICT (meeting_id, email) DO
UPDATE
SET name = CASE
        WHEN TRIM(COALESCE(p_participant_name, '')) != '' THEN TRIM(p_participant_name)
        ELSE meeting_participants.name
    END,
    is_host = false,
    -- CRITICAL: Force is_host = false (never allow true for guest participants)
    status = 'accepted',
    user_id = NULL;
-- Ensure guest has no user_id
END IF;
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
WHEN OTHERS THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'An error occurred while booking: ' || SQLERRM
);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.book_group_meeting(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_group_meeting(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO anon;
-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Your database is now ready to use.
-- All permission issues have been fixed.
-- Duplicate email handling has been fixed.
-- Participant names are now properly saved from booking forms.
-- Guest participants always have is_host = false.
-- ============================================