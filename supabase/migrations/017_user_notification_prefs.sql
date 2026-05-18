-- User notification preferences for Slack DMs.
-- Channel posts are governed by project-level slack_channel_id, not by user prefs.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notify_slack_task_assigned BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_slack_task_status   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_slack_task_threads  BOOLEAN DEFAULT TRUE;
