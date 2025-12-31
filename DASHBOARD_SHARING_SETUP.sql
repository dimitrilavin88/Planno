-- ============================================
-- DASHBOARD SHARING FUNCTIONALITY
-- ============================================
-- Phase 1: Database Foundation
-- Run this file in your Supabase SQL Editor
-- ============================================

-- Dashboard shares table
CREATE TABLE IF NOT EXISTS public.dashboard_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_user_id, shared_with_user_id),
    CONSTRAINT cannot_share_with_self CHECK (owner_user_id != shared_with_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_shares_owner ON public.dashboard_shares(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_shares_shared_with ON public.dashboard_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_shares_permission ON public.dashboard_shares(permission_level);

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dashboard_shares_updated_at ON public.dashboard_shares;
CREATE TRIGGER update_dashboard_shares_updated_at 
    BEFORE UPDATE ON public.dashboard_shares 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on dashboard_shares table
ALTER TABLE public.dashboard_shares ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Owners can manage their shares" ON public.dashboard_shares;
DROP POLICY IF EXISTS "Shared users can read their shares" ON public.dashboard_shares;

-- Policy: Owners can manage (SELECT, INSERT, UPDATE, DELETE) their own shares
CREATE POLICY "Owners can manage their shares" ON public.dashboard_shares
    FOR ALL
    USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Shared users can read (SELECT) shares where they are the shared_with_user
CREATE POLICY "Shared users can read their shares" ON public.dashboard_shares
    FOR SELECT
    USING (auth.uid() = shared_with_user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if a user has access to another user's dashboard
-- Returns the permission level ('view', 'edit', or NULL if no access)
CREATE OR REPLACE FUNCTION public.check_dashboard_access(
    p_user_id UUID,
    p_owner_user_id UUID,
    p_required_permission TEXT DEFAULT 'view'
) RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permission TEXT;
    v_has_access BOOLEAN;
BEGIN
    -- If user is the owner, they have full access (return 'edit' as highest level)
    IF p_user_id = p_owner_user_id THEN
        RETURN 'edit';
    END IF;

    -- Check if there's a share record
    SELECT permission_level INTO v_permission
    FROM public.dashboard_shares
    WHERE owner_user_id = p_owner_user_id
      AND shared_with_user_id = p_user_id;

    -- If no share found, return NULL (no access)
    IF v_permission IS NULL THEN
        RETURN NULL;
    END IF;

    -- If required permission is 'edit' but user only has 'view', deny access
    IF p_required_permission = 'edit' AND v_permission = 'view' THEN
        RETURN NULL;
    END IF;

    -- User has sufficient permission
    RETURN v_permission;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_dashboard_access(UUID, UUID, TEXT) TO authenticated, anon, service_role;

-- Function to grant dashboard access
CREATE OR REPLACE FUNCTION public.grant_dashboard_access(
    p_owner_user_id UUID,
    p_shared_email TEXT,
    p_permission_level TEXT DEFAULT 'view'
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_shared_user_id UUID;
    v_result JSONB;
BEGIN
    -- Validate permission level
    IF p_permission_level NOT IN ('view', 'edit') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid permission level. Must be "view" or "edit"'
        );
    END IF;

    -- Find user by email
    SELECT id INTO v_shared_user_id
    FROM auth.users
    WHERE email = LOWER(TRIM(p_shared_email));

    -- Check if user exists
    IF v_shared_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User with email ' || p_shared_email || ' not found'
        );
    END IF;

    -- Check if trying to share with self
    IF v_shared_user_id = p_owner_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cannot share dashboard with yourself'
        );
    END IF;

    -- Insert or update share record
    INSERT INTO public.dashboard_shares (owner_user_id, shared_with_user_id, permission_level)
    VALUES (p_owner_user_id, v_shared_user_id, p_permission_level)
    ON CONFLICT (owner_user_id, shared_with_user_id)
    DO UPDATE SET
        permission_level = EXCLUDED.permission_level,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Dashboard access granted successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_dashboard_access(UUID, TEXT, TEXT) TO authenticated, anon, service_role;

-- Function to revoke dashboard access
CREATE OR REPLACE FUNCTION public.revoke_dashboard_access(
    p_owner_user_id UUID,
    p_shared_user_id UUID
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete the share record
    DELETE FROM public.dashboard_shares
    WHERE owner_user_id = p_owner_user_id
      AND shared_with_user_id = p_shared_user_id;

    -- Check if any rows were deleted
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No share record found to revoke'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Dashboard access revoked successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.revoke_dashboard_access(UUID, UUID) TO authenticated, anon, service_role;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- The dashboard sharing functionality is now ready.
-- Next steps:
-- 1. Create UI for sharing (Phase 2)
-- 2. Add access checks to dashboard pages (Phase 3)
-- ============================================

