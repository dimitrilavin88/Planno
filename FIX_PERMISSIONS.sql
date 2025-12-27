-- ============================================
-- QUICK FIX FOR PERMISSION ERRORS
-- ============================================
-- Run this FIRST, before the main DATABASE_SETUP.sql
-- This grants the necessary permissions
-- ============================================

-- Grant permissions to access auth schema and auth.users table
GRANT USAGE ON SCHEMA auth TO postgres, service_role;
GRANT SELECT ON auth.users TO postgres, service_role;

-- That's it! Now you can run the main DATABASE_SETUP.sql

