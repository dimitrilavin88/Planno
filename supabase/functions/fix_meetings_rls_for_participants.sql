-- Allow users to see meetings where they are: host, participant (group meeting), or shared dashboard
-- Run this in Supabase SQL Editor to fix missing meetings
-- If you get "relation dashboard_shares does not exist", remove that OR clause from the policy.

DROP POLICY IF EXISTS "Hosts can read own meetings" ON public.meetings;

CREATE POLICY "Hosts can read own meetings" ON public.meetings
FOR SELECT USING (
  auth.uid() = host_user_id
  OR EXISTS (
    SELECT 1 FROM public.meeting_participants mp
    WHERE mp.meeting_id = meetings.id AND mp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.dashboard_shares ds
    WHERE ds.owner_user_id = meetings.host_user_id
    AND ds.shared_with_user_id = auth.uid()
    AND ds.permission_level IN ('view', 'edit')
  )
);

