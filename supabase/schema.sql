-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable timezone support
SET timezone = 'UTC';

-- Users table (extends auth.users)
-- This table stores additional user profile information
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event types table
-- Defines different types of meetings a user can offer
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
-- Stores weekly availability windows (independent of event types)
CREATE TABLE IF NOT EXISTS public.availability_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
    start_time TIME NOT NULL, -- Local time for the user's timezone
    end_time TIME NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Calendar connections table
-- Stores OAuth tokens and connection info for external calendars
CREATE TABLE IF NOT EXISTS public.calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
    calendar_id TEXT NOT NULL, -- External calendar ID
    calendar_name TEXT,
    access_token TEXT NOT NULL, -- Encrypted in production
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider, calendar_id)
);

-- Meetings table
-- Stores all scheduled meetings
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE RESTRICT,
    host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    location_type TEXT NOT NULL CHECK (location_type IN ('in_person', 'phone', 'video', 'custom')),
    location TEXT,
    meeting_link TEXT, -- Zoom, Google Meet, etc.
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    calendar_event_id TEXT, -- External calendar event ID
    calendar_provider TEXT CHECK (calendar_provider IN ('google', 'outlook')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_meeting_time CHECK (end_time > start_time)
);

-- Meeting participants table
-- Stores participants for meetings (supports group scheduling)
CREATE TABLE IF NOT EXISTS public.meeting_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL for external participants
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(meeting_id, email)
);

-- Booking links table
-- Stores secure, unguessable booking links for event types and group scheduling
CREATE TABLE IF NOT EXISTS public.booking_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL, -- Unguessable token for the booking link
    event_type_id UUID REFERENCES public.event_types(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- For user-level booking pages
    link_type TEXT NOT NULL CHECK (link_type IN ('event_type', 'user', 'group')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group event types table (for group scheduling)
-- Links multiple event types together for group bookings
CREATE TABLE IF NOT EXISTS public.group_event_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    location_type TEXT NOT NULL CHECK (location_type IN ('in_person', 'phone', 'video', 'custom')),
    location TEXT,
    booking_link TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group event type hosts table
-- Links hosts to group event types
CREATE TABLE IF NOT EXISTS public.group_event_type_hosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_event_type_id UUID NOT NULL REFERENCES public.group_event_types(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_event_type_id, user_id)
);

-- Time slot locks table (for atomic booking)
-- Prevents double-booking during concurrent requests
CREATE TABLE IF NOT EXISTS public.time_slot_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type_id UUID REFERENCES public.event_types(id) ON DELETE CASCADE,
    group_event_type_id UUID REFERENCES public.group_event_types(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    locked_by TEXT NOT NULL, -- Session/request identifier
    expires_at TIMESTAMPTZ NOT NULL, -- Lock expires after 30 seconds
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

