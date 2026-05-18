-- User status gate for Slack SSO + admin approval flow
-- Status: 'pending' = new sign-in, awaiting admin approval
--         'active'  = approved, normal access
--         'disabled' = revoked

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Existing users stay active (don't lock current accounts out)
UPDATE public.users SET status = 'active' WHERE status IS NULL OR status = 'pending';

-- Replace the auth.users → public.users trigger so new sign-ins land as 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    'team',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is in place (drop+recreate to pick up new function body)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
