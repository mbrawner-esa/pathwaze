-- Project threads — mirror of Slack messages from linked project channels.
-- Used to populate the "Threads" tab and feed into the master "Activity" feed.

CREATE TABLE IF NOT EXISTS public.project_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slack_channel_id TEXT NOT NULL,
  slack_ts TEXT NOT NULL,
  slack_thread_ts TEXT,
  slack_user_id TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_avatar_url TEXT,
  message TEXT NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slack_channel_id, slack_ts)
);

CREATE INDEX IF NOT EXISTS project_threads_project_idx
  ON public.project_threads(project_id, created_at DESC);

ALTER TABLE public.project_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.project_threads
  FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

CREATE POLICY "Team project threads" ON public.project_threads
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'team');
