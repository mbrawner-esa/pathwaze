-- Slack profile sync — pull avatar, timezone, title from Slack into Pathwaze
-- so co-worker headshots show in avatars, timezones inform scheduling, etc.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url         TEXT,
  ADD COLUMN IF NOT EXISTS timezone           TEXT,
  ADD COLUMN IF NOT EXISTS timezone_label     TEXT,
  ADD COLUMN IF NOT EXISTS title              TEXT,
  ADD COLUMN IF NOT EXISTS slack_display_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_synced_at  TIMESTAMPTZ;

-- Update handle_new_user trigger to also capture avatar URL from Slack OIDC `picture` claim.
-- Timezone/title need a follow-up users.info API call (handled in app code).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite      RECORD;
  user_role   TEXT;
  user_status TEXT;
  slack_id    TEXT;
  avatar      TEXT;
BEGIN
  SELECT * INTO invite FROM public.invited_emails WHERE lower(email) = lower(NEW.email) LIMIT 1;
  user_role := COALESCE(invite.role, 'team');
  user_status := CASE WHEN invite.email IS NOT NULL THEN 'active' ELSE 'pending' END;
  slack_id := COALESCE(
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'https://slack.com/user_id',
    split_part(NEW.raw_user_meta_data->>'sub', '-', 1)
  );
  avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'https://slack.com/user_image_512'
  );

  INSERT INTO public.users (id, email, full_name, role, status, slack_user_id, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    user_role,
    user_status,
    slack_id,
    avatar
  )
  ON CONFLICT (id) DO UPDATE
    SET slack_user_id = COALESCE(public.users.slack_user_id, EXCLUDED.slack_user_id),
        avatar_url    = COALESCE(public.users.avatar_url, EXCLUDED.avatar_url);

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

-- Backfill avatar for existing Slack-signed-in users
UPDATE public.users u
SET avatar_url = COALESCE(
  a.raw_user_meta_data->>'avatar_url',
  a.raw_user_meta_data->>'picture',
  a.raw_user_meta_data->>'https://slack.com/user_image_512'
)
FROM auth.users a
WHERE u.id = a.id
  AND u.avatar_url IS NULL
  AND (a.raw_user_meta_data ? 'avatar_url' OR a.raw_user_meta_data ? 'picture');
