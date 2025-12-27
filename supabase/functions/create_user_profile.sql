-- Function to create user profile after signup
-- This should be called via a database trigger or Supabase Edge Function

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile with default timezone
  -- Username will be set during profile setup
  INSERT INTO public.users (id, username, timezone)
  VALUES (
    NEW.id,
    'user_' || substr(NEW.id::text, 1, 8), -- Temporary username based on user ID
    'UTC'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

