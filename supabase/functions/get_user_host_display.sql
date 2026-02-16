-- Run this in Supabase SQL Editor if not already applied.
-- Returns display string for host selection: "Last Name, First Name - username"
-- Uses first_name and last_name from auth metadata when available
CREATE OR REPLACE FUNCTION public.get_user_host_display(p_user_id UUID) RETURNS TEXT SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_username TEXT;
  v_result TEXT;
BEGIN
  -- Get first_name and last_name from auth metadata
  SELECT 
    raw_user_meta_data->>'first_name',
    raw_user_meta_data->>'last_name'
  INTO v_first_name, v_last_name
  FROM auth.users
  WHERE id = p_user_id;

  -- Get username from public.users
  SELECT username INTO v_username
  FROM public.users
  WHERE id = p_user_id;

  v_username := COALESCE(TRIM(v_username), 'unknown');

  -- Format: "Last, First - username" when we have both names
  IF v_first_name IS NOT NULL AND TRIM(v_first_name) != '' 
     AND v_last_name IS NOT NULL AND TRIM(v_last_name) != '' THEN
    v_result := TRIM(v_last_name) || ', ' || TRIM(v_first_name) || ' - ' || v_username;
  -- Format: "First - username" when only first name
  ELSIF v_first_name IS NOT NULL AND TRIM(v_first_name) != '' THEN
    v_result := TRIM(v_first_name) || ' - ' || v_username;
  -- Format: "Last - username" when only last name
  ELSIF v_last_name IS NOT NULL AND TRIM(v_last_name) != '' THEN
    v_result := TRIM(v_last_name) || ' - ' || v_username;
  -- Fallback: try full_name from metadata
  ELSE
    SELECT raw_user_meta_data->>'full_name' INTO v_first_name
    FROM auth.users WHERE id = p_user_id;
    IF v_first_name IS NOT NULL AND TRIM(v_first_name) != '' THEN
      v_result := TRIM(v_first_name) || ' - ' || v_username;
    ELSE
      v_result := v_username;
    END IF;
  END IF;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    SELECT username INTO v_username FROM public.users WHERE id = p_user_id;
    RETURN COALESCE(v_username, 'User');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_user_host_display(UUID) TO authenticated, anon, service_role;
