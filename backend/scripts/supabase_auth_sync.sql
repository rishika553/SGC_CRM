-- Supabase Auth to public.users Automatic Sync Trigger
-- Run this script in your Supabase SQL Editor to auto-create user records in public.users when a user signs up.

CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS trigger AS $$
DECLARE
    default_role_id uuid;
BEGIN
    -- Fetch SUPER_ADMIN role ID (or fallback to any available role)
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'SUPER_ADMIN' LIMIT 1;

    INSERT INTO public.users (
        id,
        email,
        first_name,
        last_name,
        role_id,
        is_active,
        is_verified,
        created_at,
        updated_at
    )
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'first_name', 'User'),
        COALESCE(new.raw_user_meta_data->>'last_name', ''),
        default_role_id,
        true,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_supabase_user();
