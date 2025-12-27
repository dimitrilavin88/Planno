-- ============================================
-- PLANNO DATABASE SETUP - FIXED VERSION
-- ============================================
-- This version fixes permission issues with auth schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- First, grant necessary permissions to access auth.users in functions
-- This allows SECURITY DEFINER functions to read from auth.users
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT SELECT ON auth.users TO postgres, service_role;

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
    location_type TEXT NOT NULL CHECK (location_type IN ('in_person', 'phone', 'video', 'custom')),
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
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
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
    location_type TEXT NOT NULL CHECK (location_type IN ('in_person', 'phone', 'video', 'custom')),
    location TEXT,
    meeting_link TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
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
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
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
    location_type TEXT NOT NULL CHECK (location_type IN ('in_person', 'phone', 'video', 'custom')),
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
        (event_type_id IS NOT NULL AND group_event_type_id IS NULL) OR
        (event_type_id IS NULL AND group_event_type_id IS NOT NULL)
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
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_types_updated_at BEFORE UPDATE ON public.event_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_rules_updated_at BEFORE UPDATE ON public.availability_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendars_updated_at BEFORE UPDATE ON public.calendars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_participants_updated_at BEFORE UPDATE ON public.meeting_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_links_updated_at BEFORE UPDATE ON public.booking_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_event_types_updated_at BEFORE UPDATE ON public.group_event_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Note: auth.uid() is a built-in Supabase function, no need to create auth.user_id()

-- USERS TABLE POLICIES
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Public can read usernames"
  ON public.users FOR SELECT
  USING (true);

-- EVENT TYPES TABLE POLICIES
CREATE POLICY "Users can read own event types"
  ON public.event_types FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own event types"
  ON public.event_types FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own event types"
  ON public.event_types FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own event types"
  ON public.event_types FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Public can read active event types by booking link"
  ON public.event_types FOR SELECT
  USING (is_active = true);

-- AVAILABILITY RULES TABLE POLICIES
CREATE POLICY "Users can manage own availability rules"
  ON public.availability_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CALENDARS TABLE POLICIES
CREATE POLICY "Users can manage own calendars"
  ON public.calendars FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- MEETINGS TABLE POLICIES
CREATE POLICY "Hosts can read own meetings"
  ON public.meetings FOR SELECT
  USING (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update own meetings"
  ON public.meetings FOR UPDATE
  USING (auth.uid() = host_user_id);

CREATE POLICY "Hosts can delete own meetings"
  ON public.meetings FOR DELETE
  USING (auth.uid() = host_user_id);

-- MEETING PARTICIPANTS TABLE POLICIES
CREATE POLICY "Participants can read own meetings"
  ON public.meeting_participants FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_id AND m.host_user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can update own status"
  ON public.meeting_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- BOOKING LINKS TABLE POLICIES
CREATE POLICY "Users can read own booking links"
  ON public.booking_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own booking links"
  ON public.booking_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read active booking links"
  ON public.booking_links FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- GROUP EVENT TYPES TABLE POLICIES
CREATE POLICY "Hosts can read group event types"
  ON public.group_event_types FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth
      WHERE geth.group_event_type_id = group_event_types.id
      AND geth.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can insert group event types"
  ON public.group_event_types FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Hosts can update group event types"
  ON public.group_event_types FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth
      WHERE geth.group_event_type_id = group_event_types.id
      AND geth.user_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can delete group event types"
  ON public.group_event_types FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth
      WHERE geth.group_event_type_id = group_event_types.id
      AND geth.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can read active group event types by booking link"
  ON public.group_event_types FOR SELECT
  USING (is_active = true);

-- GROUP EVENT TYPE HOSTS TABLE POLICIES
CREATE POLICY "Hosts can read group event type hosts"
  ON public.group_event_type_hosts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth2
      WHERE geth2.group_event_type_id = group_event_type_hosts.group_event_type_id
      AND geth2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert group event type hosts"
  ON public.group_event_type_hosts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own group event type host"
  ON public.group_event_type_hosts FOR DELETE
  USING (auth.uid() = user_id);

-- TIME SLOT LOCKS TABLE POLICIES
CREATE POLICY "Service role only for time slot locks"
  ON public.time_slot_locks FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================
-- SECTION 3: USER PROFILE FUNCTIONS
-- ============================================

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update username with uniqueness check
CREATE OR REPLACE FUNCTION public.update_username(
  p_user_id UUID,
  p_username TEXT
)
RETURNS JSONB 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (p_username ~ '^[a-zA-Z0-9_]{3,30}$') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
    );
  END IF;

  BEGIN
    UPDATE public.users
    SET username = LOWER(p_username)
    WHERE id = p_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'username', LOWER(p_username)
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Username is already taken'
      );
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to update username'
      );
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECTION 4: HELPER FUNCTION FOR USER EMAIL
-- ============================================
-- This function safely retrieves user email for use in other functions

CREATE OR REPLACE FUNCTION public.get_user_email(p_user_id UUID)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = p_user_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated, anon, service_role;

-- ============================================
-- SECTION 5: BOOKING FUNCTIONS
-- ============================================

-- Function to calculate available time slots (continued in next message due to length)
-- Note: The rest of the functions remain the same but will use get_user_email() helper

