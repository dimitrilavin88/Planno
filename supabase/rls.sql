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

-- Helper function to check if a user is authenticated
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql STABLE;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Public users can read usernames for booking pages
CREATE POLICY "Public can read usernames"
  ON public.users FOR SELECT
  USING (true);

-- ============================================
-- EVENT TYPES TABLE POLICIES
-- ============================================

-- Users can read their own event types
CREATE POLICY "Users can read own event types"
  ON public.event_types FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own event types
CREATE POLICY "Users can insert own event types"
  ON public.event_types FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own event types
CREATE POLICY "Users can update own event types"
  ON public.event_types FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own event types
CREATE POLICY "Users can delete own event types"
  ON public.event_types FOR DELETE
  USING (auth.uid() = user_id);

-- Public can read active event types via booking link
CREATE POLICY "Public can read active event types by booking link"
  ON public.event_types FOR SELECT
  USING (is_active = true);

-- ============================================
-- AVAILABILITY RULES TABLE POLICIES
-- ============================================

-- Users can manage their own availability rules
CREATE POLICY "Users can manage own availability rules"
  ON public.availability_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- CALENDARS TABLE POLICIES
-- ============================================

-- Users can manage their own calendar connections
CREATE POLICY "Users can manage own calendars"
  ON public.calendars FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- MEETINGS TABLE POLICIES
-- ============================================

-- Hosts can read their own meetings
CREATE POLICY "Hosts can read own meetings"
  ON public.meetings FOR SELECT
  USING (auth.uid() = host_user_id);

-- Hosts can update their own meetings
CREATE POLICY "Hosts can update own meetings"
  ON public.meetings FOR UPDATE
  USING (auth.uid() = host_user_id);

-- Hosts can delete their own meetings
CREATE POLICY "Hosts can delete own meetings"
  ON public.meetings FOR DELETE
  USING (auth.uid() = host_user_id);

-- Note: Meetings are inserted via RPC functions for atomic booking
-- No direct INSERT policy needed

-- ============================================
-- MEETING PARTICIPANTS TABLE POLICIES
-- ============================================

-- Participants can read meetings they're part of
CREATE POLICY "Participants can read own meetings"
  ON public.meeting_participants FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_id AND m.host_user_id = auth.uid()
    )
  );

-- Participants can update their own status
CREATE POLICY "Participants can update own status"
  ON public.meeting_participants FOR UPDATE
  USING (auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Note: Participants are inserted via RPC functions
-- No direct INSERT policy needed

-- ============================================
-- BOOKING LINKS TABLE POLICIES
-- ============================================

-- Users can read their own booking links
CREATE POLICY "Users can read own booking links"
  ON public.booking_links FOR SELECT
  USING (auth.uid() = user_id);

-- Users can manage their own booking links
CREATE POLICY "Users can manage own booking links"
  ON public.booking_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public can read active booking links by token
CREATE POLICY "Public can read active booking links"
  ON public.booking_links FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- ============================================
-- GROUP EVENT TYPES TABLE POLICIES
-- ============================================

-- Hosts can read group event types they're part of
CREATE POLICY "Hosts can read group event types"
  ON public.group_event_types FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth
      WHERE geth.group_event_type_id = group_event_types.id
      AND geth.user_id = auth.uid()
    )
  );

-- Hosts can insert group event types (must also be added to group_event_type_hosts)
CREATE POLICY "Hosts can insert group event types"
  ON public.group_event_types FOR INSERT
  WITH CHECK (true); -- Validation happens in RPC function

-- Hosts can update group event types they're part of
CREATE POLICY "Hosts can update group event types"
  ON public.group_event_types FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth
      WHERE geth.group_event_type_id = group_event_types.id
      AND geth.user_id = auth.uid()
    )
  );

-- Hosts can delete group event types they're part of
CREATE POLICY "Hosts can delete group event types"
  ON public.group_event_types FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth
      WHERE geth.group_event_type_id = group_event_types.id
      AND geth.user_id = auth.uid()
    )
  );

-- Public can read active group event types via booking link
CREATE POLICY "Public can read active group event types by booking link"
  ON public.group_event_types FOR SELECT
  USING (is_active = true);

-- ============================================
-- GROUP EVENT TYPE HOSTS TABLE POLICIES
-- ============================================

-- Hosts can read group event type hosts
CREATE POLICY "Hosts can read group event type hosts"
  ON public.group_event_type_hosts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_event_type_hosts geth2
      WHERE geth2.group_event_type_id = group_event_type_hosts.group_event_type_id
      AND geth2.user_id = auth.uid()
    )
  );

-- Users can insert themselves as hosts (validation in RPC)
CREATE POLICY "Users can insert group event type hosts"
  ON public.group_event_type_hosts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete themselves from group event types
CREATE POLICY "Users can delete own group event type host"
  ON public.group_event_type_hosts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TIME SLOT LOCKS TABLE POLICIES
-- ============================================

-- Only service role can manage time slot locks
-- This table is used internally by RPC functions only
-- No public access needed

CREATE POLICY "Service role only for time slot locks"
  ON public.time_slot_locks FOR ALL
  USING (false)
  WITH CHECK (false);

-- Note: RPC functions will use SECURITY DEFINER to bypass RLS for locks

