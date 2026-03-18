-- ============================================================
-- ePromos Tracker — Schema v2 (Supabase Auth + Profiles)
-- Run this in the Supabase SQL Editor AFTER running v1
-- ============================================================

-- 1. Profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  department  TEXT NOT NULL DEFAULT '',
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can view the full profile list
-- (needed for task owner dropdown)
CREATE POLICY "Authenticated users can view profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can update only their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role (used by the /api/employees/invite route) has full access
CREATE POLICY "Service role full access" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Trigger: auto-create a profile row whenever a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, department, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', ''),
    COALESCE(NEW.raw_user_meta_data->>'department', ''),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4. Create your first admin user
--
-- STEP 1: In Supabase → Authentication → Users → Add User,
--         create your own account manually.
--
-- STEP 2: Run this query (replace the email with yours) to
--         grant yourself admin access:
--
-- UPDATE profiles
-- SET is_admin = true, name = 'Your Name', department = 'Sales', role = 'Enterprise Business Managers'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'you@epromos.com');
--
-- ============================================================
