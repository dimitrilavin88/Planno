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