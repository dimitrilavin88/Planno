-- Require that grant/revoke dashboard access is only callable by the owner or by a user with edit access.

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
    v_caller_id UUID;
    v_edit_level TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Caller must be the owner or have edit access to the owner's dashboard
    IF v_caller_id != p_owner_user_id THEN
        v_edit_level := public.check_dashboard_access(v_caller_id, p_owner_user_id, 'edit');
        IF v_edit_level IS NULL OR v_edit_level != 'edit' THEN
            RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to manage this dashboard');
        END IF;
    END IF;

    IF p_permission_level NOT IN ('view', 'edit') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid permission level. Must be "view" or "edit"'
        );
    END IF;

    SELECT id INTO v_shared_user_id
    FROM auth.users
    WHERE email = LOWER(TRIM(p_shared_email));

    IF v_shared_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User with email ' || p_shared_email || ' not found'
        );
    END IF;

    IF v_shared_user_id = p_owner_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cannot share dashboard with yourself'
        );
    END IF;

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

CREATE OR REPLACE FUNCTION public.revoke_dashboard_access(
    p_owner_user_id UUID,
    p_shared_user_id UUID
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_edit_level TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF v_caller_id != p_owner_user_id THEN
        v_edit_level := public.check_dashboard_access(v_caller_id, p_owner_user_id, 'edit');
        IF v_edit_level IS NULL OR v_edit_level != 'edit' THEN
            RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to manage this dashboard');
        END IF;
    END IF;

    DELETE FROM public.dashboard_shares
    WHERE owner_user_id = p_owner_user_id
      AND shared_with_user_id = p_shared_user_id;

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
