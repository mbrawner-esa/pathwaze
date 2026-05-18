-- Pre-approved invites — when an admin invites by email, we drop a row here.
-- When the invitee signs in with Slack and emails match, the handle_new_user
-- trigger auto-marks them 'active' (no admin approval needed) and assigns the
-- pre-set role.

CREATE TABLE IF NOT EXISTS public.invited_emails (
  email       TEXT PRIMARY KEY,
  role        TEXT NOT NULL DEFAULT 'team',
  invited_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at  TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE public.invited_emails ENABLE ROW LEVEL SECURITY;

-- Admin-only access
DROP POLICY IF EXISTS "Admin invites full access" ON public.invited_emails;
CREATE POLICY "Admin invites full access" ON public.invited_emails
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Replace handle_new_user so pre-invited emails skip the pending queue
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite RECORD;
  user_role TEXT;
  user_status TEXT;
BEGIN
  SELECT * INTO invite FROM public.invited_emails WHERE lower(email) = lower(NEW.email) LIMIT 1;
  user_role := COALESCE(invite.role, 'team');
  user_status := CASE WHEN invite.email IS NOT NULL THEN 'active' ELSE 'pending' END;

  INSERT INTO public.users (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    user_role,
    user_status
  )
  ON CONFLICT (id) DO NOTHING;

  -- Stamp the invite as accepted
  IF invite.email IS NOT NULL THEN
    UPDATE public.invited_emails SET accepted_at = now() WHERE lower(email) = lower(NEW.email);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
