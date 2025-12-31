-- ============================================
-- DASHBOARD SHARING - RLS POLICIES UPDATE
-- ============================================
-- Phase 3: Access Control - RLS Policies
-- Run this file in your Supabase SQL Editor AFTER running DASHBOARD_SHARING_SETUP.sql
-- ============================================
-- ============================================
-- UPDATE EXISTING RLS POLICIES
-- ============================================
-- EVENT TYPES: Update existing policy to allow shared users to read owner's event types
DROP POLICY IF EXISTS "Users can read own event types" ON public.event_types;
CREATE POLICY "Users can read own event types" ON public.event_types FOR
SELECT USING (
        -- Owner can read their own
        auth.uid() = user_id
        OR -- Shared user with view or edit access can read
        EXISTS (
            SELECT 1
            FROM public.dashboard_shares
            WHERE owner_user_id = event_types.user_id
                AND shared_with_user_id = auth.uid()
                AND permission_level IN ('view', 'edit')
        )
    );
-- EVENT TYPES: Update existing policies to allow shared users with edit access
DROP POLICY IF EXISTS "Users can insert own event types" ON public.event_types;
CREATE POLICY "Users can insert own event types" ON public.event_types FOR
INSERT WITH CHECK (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1
            FROM public.dashboard_shares
            WHERE owner_user_id = event_types.user_id
                AND shared_with_user_id = auth.uid()
                AND permission_level = 'edit'
        )
    );
DROP POLICY IF EXISTS "Users can update own event types" ON public.event_types;
CREATE POLICY "Users can update own event types" ON public.event_types FOR
UPDATE USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1
            FROM public.dashboard_shares
            WHERE owner_user_id = event_types.user_id
                AND shared_with_user_id = auth.uid()
                AND permission_level = 'edit'
        )
    ) WITH CHECK (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1
            FROM public.dashboard_shares
            WHERE owner_user_id = event_types.user_id
                AND shared_with_user_id = auth.uid()
                AND permission_level = 'edit'
        )
    );
DROP POLICY IF EXISTS "Users can delete own event types" ON public.event_types;
CREATE POLICY "Users can delete own event types" ON public.event_types FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1
        FROM public.dashboard_shares
        WHERE owner_user_id = event_types.user_id
            AND shared_with_user_id = auth.uid()
            AND permission_level = 'edit'
    )
);
-- AVAILABILITY RULES: Update existing policy to allow shared users
DROP POLICY IF EXISTS "Users can manage own availability rules" ON public.availability_rules;
CREATE POLICY "Users can manage own availability rules" ON public.availability_rules FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1
        FROM public.dashboard_shares
        WHERE owner_user_id = availability_rules.user_id
            AND shared_with_user_id = auth.uid()
            AND permission_level IN ('view', 'edit')
    )
) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1
        FROM public.dashboard_shares
        WHERE owner_user_id = availability_rules.user_id
            AND shared_with_user_id = auth.uid()
            AND permission_level = 'edit'
    )
);
-- MEETINGS: Update existing policies to allow shared users
DROP POLICY IF EXISTS "Hosts can read own meetings" ON public.meetings;
CREATE POLICY "Hosts can read own meetings" ON public.meetings FOR
SELECT USING (
        auth.uid() = host_user_id
        OR EXISTS (
            SELECT 1
            FROM public.dashboard_shares
            WHERE owner_user_id = meetings.host_user_id
                AND shared_with_user_id = auth.uid()
                AND permission_level IN ('view', 'edit')
        )
    );
DROP POLICY IF EXISTS "Hosts can update own meetings" ON public.meetings;
CREATE POLICY "Hosts can update own meetings" ON public.meetings FOR
UPDATE USING (
        auth.uid() = host_user_id
        OR EXISTS (
            SELECT 1
            FROM public.dashboard_shares
            WHERE owner_user_id = meetings.host_user_id
                AND shared_with_user_id = auth.uid()
                AND permission_level = 'edit'
        )
    ) WITH CHECK (
        auth.uid() = host_user_id
        OR EXISTS (
            SELECT 1
            FROM public.dashboard_shares
            WHERE owner_user_id = meetings.host_user_id
                AND shared_with_user_id = auth.uid()
                AND permission_level = 'edit'
        )
    );
-- CALENDARS: Update existing policy to allow shared users to read (view only)
DROP POLICY IF EXISTS "Users can manage own calendars" ON public.calendars;
-- Read policy for owners and shared users
CREATE POLICY "Users can read own calendars" ON public.calendars FOR
SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1
            FROM public.dashboard_shares
            WHERE owner_user_id = calendars.user_id
                AND shared_with_user_id = auth.uid()
                AND permission_level IN ('view', 'edit')
        )
    );
-- Write policies (only for owners, not shared users - security)
CREATE POLICY "Users can insert own calendars" ON public.calendars FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendars" ON public.calendars FOR
UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendars" ON public.calendars FOR DELETE USING (auth.uid() = user_id);
-- Note: Calendar connections should remain owner-only for security
-- Shared users can see calendar status but cannot modify connections
-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- RLS policies updated to support dashboard sharing
-- Shared users can now:
-- - View owner's event types, availability, meetings, calendars
-- - Edit owner's data if they have 'edit' permission
-- ============================================