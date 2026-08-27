-- Schema for the 2026-08-26 team-reported bug batch.
-- ⚠️ Run on Supabase. Idempotent — safe to re-run.
--
-- Three unrelated-but-small changes, batched so the user runs one file:
--   (1) project_notes.category — which project tab a note was written from, so
--       the tab's own Activity feed can show it (today notes only reach Threads).
--   (2) task_threads.edited_at — lets a comment show "edited" after an in-place
--       revision. Editing/deleting is author-scoped in the route, not by RLS.
--   (3) users.notify_* — opt-outs for the two new notifications: an approval
--       request landing on the approver, and the daily due-date reminder.

-- ── (1) Notes remember which tab they were written from ──────────────
-- Nullable on purpose: notes written from the Threads or Tasks tab (and every
-- note that already exists) have no tab scope and stay Threads-only.
alter table public.project_notes
  add column if not exists category text;

comment on column public.project_notes.category is
  'Project tab the note was authored from (site|utility|stakeholders|permitting|technical|financial|drawings). NULL = not tab-scoped; shows only in Threads.';

create index if not exists project_notes_project_category_idx
  on public.project_notes(project_id, category);

-- ── (2) Task comments can be edited ──────────────────────────────────
alter table public.task_threads
  add column if not exists edited_at timestamptz;

comment on column public.task_threads.edited_at is
  'Set when the author revises the message in place. NULL = never edited.';

-- ── (3) Notification opt-outs for the two new senders ────────────────
alter table public.users
  add column if not exists notify_slack_task_approval boolean not null default true,
  add column if not exists notify_email_task_approval boolean not null default true,
  add column if not exists notify_slack_task_due      boolean not null default true,
  add column if not exists notify_email_task_due      boolean not null default true;

comment on column public.users.notify_slack_task_approval is 'Slack DM when a task you approve moves to Under Review.';
comment on column public.users.notify_email_task_approval is 'Email when a task you approve moves to Under Review.';
comment on column public.users.notify_slack_task_due      is 'Daily Slack DM for tasks assigned to you due within 3 days, or overdue.';
comment on column public.users.notify_email_task_due      is 'Daily email for tasks assigned to you due within 3 days, or overdue.';
