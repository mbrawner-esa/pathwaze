-- Give the `manager` role access to project_threads.
-- Migration 019 created RLS policies for `admin` and `team` only; the `manager`
-- role was added later (024) but never got a policy on this table, so a manager
-- reading a project's Threads tab (RLS-scoped client) gets ZERO rows — both the
-- Slack mirror and the mirrored Outlook email. This matches the manager access
-- model elsewhere ("sees + edits everything").
-- ⚠️ Run on Supabase. Idempotent — safe to re-run.

DROP POLICY IF EXISTS "Manager project threads" ON public.project_threads;
CREATE POLICY "Manager project threads" ON public.project_threads
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'manager');
