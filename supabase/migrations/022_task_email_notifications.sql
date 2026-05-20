-- Task email notifications
--
-- Adds:
--   tasks.created_by   — who created the task (so we know who to email on completion)
--   users.notify_email_task_assigned — opt-out for the "new task assigned to you" email
--   users.notify_email_task_complete — opt-out for the "task you created is complete" email
--
-- Parallels the existing Slack notification system (lib/slack.ts + users.notify_slack_*).

-- 1. Track task creator. Nullable because existing tasks weren't tracked.
alter table public.tasks
  add column if not exists created_by uuid references public.users(id) on delete set null;

-- Backfill: best guess is that the assignee created the task. Not perfect, but
-- reasonable for the small set of existing rows. Users can ignore the imperfect
-- attribution; new tasks will be tracked correctly going forward.
update public.tasks
  set created_by = assignee_id
  where created_by is null and assignee_id is not null;

-- 2. Email notification preferences (default on, like the Slack ones).
alter table public.users
  add column if not exists notify_email_task_assigned boolean not null default true,
  add column if not exists notify_email_task_complete boolean not null default true;

comment on column public.tasks.created_by is 'User who created the task. Used to email the requestor when their task is completed.';
comment on column public.users.notify_email_task_assigned is 'Send an email when a teammate assigns you a task.';
comment on column public.users.notify_email_task_complete is 'Send an email when a task you created is marked complete.';
