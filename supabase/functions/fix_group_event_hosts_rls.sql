-- ============================================
-- FIX: Infinite recursion in group_event_type_hosts RLS
-- ============================================
-- The "Hosts can read group event type hosts" policy queried the same table
-- it was protecting, causing infinite recursion. This uses a SECURITY DEFINER
-- function to check host membership without triggering RLS.
-- Run this in Supabase SQL Editor.
-- ============================================

-- Helper function: Check if user is a host of a group event type (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_group_event_host(
  p_group_event_type_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.group_event_type_hosts
    WHERE group_event_type_id = p_group_event_type_id
      AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.is_group_event_host(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_event_host(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_group_event_host(UUID, UUID) TO service_role;

-- Replace the recursive policy with one that uses the helper function
DROP POLICY IF EXISTS "Hosts can read group event type hosts" ON public.group_event_type_hosts;
CREATE POLICY "Hosts can read group event type hosts" ON public.group_event_type_hosts
FOR SELECT USING (public.is_group_event_host(group_event_type_id, auth.uid()));

-- Helper: Allow insert when user is adding themselves OR when group has no hosts yet (creator adding all hosts)
CREATE OR REPLACE FUNCTION public.can_insert_group_event_host(
  p_group_event_type_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- User can always add themselves as a host
  IF p_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  -- User can add other users as hosts only if the group has no hosts yet
  -- (they're the creator doing initial setup - allows multi-host insert in one go)
  RETURN NOT EXISTS (
    SELECT 1 FROM public.group_event_type_hosts
    WHERE group_event_type_id = p_group_event_type_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.can_insert_group_event_host(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_insert_group_event_host(UUID, UUID) TO service_role;

-- Replace restrictive INSERT policy: allow creator to add all hosts, or users to add themselves
DROP POLICY IF EXISTS "Users can insert group event type hosts" ON public.group_event_type_hosts;
CREATE POLICY "Users can insert group event type hosts" ON public.group_event_type_hosts
FOR INSERT WITH CHECK (public.can_insert_group_event_host(group_event_type_id, user_id));

-- Allow hosts to delete any host in groups they belong to (for edit flow when replacing host list)
DROP POLICY IF EXISTS "Users can delete own group event type host" ON public.group_event_type_hosts;
CREATE POLICY "Hosts can delete group event type hosts" ON public.group_event_type_hosts
FOR DELETE USING (public.is_group_event_host(group_event_type_id, auth.uid()));
