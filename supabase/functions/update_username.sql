-- Function to update username with uniqueness check
-- This ensures atomic username updates

CREATE OR REPLACE FUNCTION public.update_username(
  p_user_id UUID,
  p_username TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Validate username format (alphanumeric and underscores, 3-30 chars)
  IF NOT (p_username ~ '^[a-zA-Z0-9_]{3,30}$') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
    );
  END IF;

  -- Try to update username
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

