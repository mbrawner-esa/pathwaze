-- Slack integration scaffolding
-- - users.slack_user_id     → cached Slack user ID (looked up by email on first need)
-- - projects.slack_channel_id → channel where project events get posted
-- - tasks.slack_dm_channel + slack_dm_ts → so we can update/thread the DM later

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS slack_dm_channel TEXT,
  ADD COLUMN IF NOT EXISTS slack_dm_ts TEXT;

-- Update trigger so first-time Slack sign-ins persist their Slack user_id from OIDC claims
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite      RECORD;
  user_role   TEXT;
  user_status TEXT;
  slack_id    TEXT;
BEGIN
  SELECT * INTO invite FROM public.invited_emails WHERE lower(email) = lower(NEW.email) LIMIT 1;
  user_role := COALESCE(invite.role, 'team');
  user_status := CASE WHEN invite.email IS NOT NULL THEN 'active' ELSE 'pending' END;

  -- Slack OIDC: provider_id is the Slack user ID; sub is "U... -T..."; either works
  slack_id := COALESCE(
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'https://slack.com/user_id',
    split_part(NEW.raw_user_meta_data->>'sub', '-', 1)
  );

  INSERT INTO public.users (id, email, full_name, role, status, slack_user_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    user_role,
    user_status,
    slack_id
  )
  ON CONFLICT (id) DO UPDATE
    SET slack_user_id = COALESCE(public.users.slack_user_id, EXCLUDED.slack_user_id);

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

-- Backfill: pull slack_user_id for any existing users who have it in their auth metadata.
-- Safe to re-run; only fills when currently NULL.
UPDATE public.users u
SET slack_user_id = COALESCE(
  a.raw_user_meta_data->>'provider_id',
  a.raw_user_meta_data->>'https://slack.com/user_id',
  split_part(a.raw_user_meta_data->>'sub', '-', 1)
)
FROM auth.users a
WHERE u.id = a.id
  AND u.slack_user_id IS NULL
  AND (
    a.raw_user_meta_data ? 'provider_id'
    OR a.raw_user_meta_data ? 'https://slack.com/user_id'
    OR a.raw_user_meta_data ? 'sub'
  );
