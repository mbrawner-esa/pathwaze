-- Extend project_threads to hold mirrored email (Outlook) messages alongside
-- the existing Slack mirror. A thread row is now either source='slack' (the
-- original behavior) or source='email' (populated by the email-sync cron).
--
-- The Slack-specific columns become nullable so email rows can omit them.
-- Existing rows keep source='slack' via the column default.

ALTER TABLE public.project_threads
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'slack',
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS from_addr TEXT,
  ADD COLUMN IF NOT EXISTS to_addr TEXT,
  ADD COLUMN IF NOT EXISTS message_id TEXT,        -- Graph message id (dedup key)
  ADD COLUMN IF NOT EXISTS conversation_id TEXT;   -- Graph conversationId (threading)

-- Slack columns were NOT NULL; email rows don't have them.
ALTER TABLE public.project_threads ALTER COLUMN slack_channel_id DROP NOT NULL;
ALTER TABLE public.project_threads ALTER COLUMN slack_ts DROP NOT NULL;

-- Dedup mirrored emails per project. Keyed on (project_id, message_id) rather
-- than message_id alone, so one email that touches stakeholders on two
-- different projects can land in each project's thread exactly once.
--
-- Deliberately NOT a partial index: the email-sync upsert relies on
-- `ON CONFLICT (project_id, message_id)`, which can only infer a full unique
-- index. Slack rows have message_id = NULL and NULLs are distinct, so they
-- never collide here (their dedup is the existing UNIQUE(slack_channel_id, slack_ts)).
CREATE UNIQUE INDEX IF NOT EXISTS project_threads_email_uniq
  ON public.project_threads(project_id, message_id);

-- Handy for source-filtered reads.
CREATE INDEX IF NOT EXISTS project_threads_source_idx
  ON public.project_threads(project_id, source);
