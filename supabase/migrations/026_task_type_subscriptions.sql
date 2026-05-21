-- Task-type subscriptions — replaces the original "teams" concept.
--
-- Each user subscribes to one or more task types (Design, Engineering, etc).
-- For users with role='team', the task list shows:
--   - Tasks they're involved in (created/assignee/approver) — always
--   - Public tasks whose type is in their subscriptions
--   - Their own private tasks
--
-- admin / manager users see all tasks regardless (subject to visibility rules
-- already enforced by migration 025).
--
-- Default = subscribed to all 9 task types. New invitees start fully subscribed
-- and can narrow down in Settings. Mirrors how Slack notification channels work.

alter table public.users
  add column if not exists subscribed_task_types text[] not null default array[
    'Design', 'Engineering', 'Permitting', 'Interconnection',
    'Financial', 'Legal', 'Construction', 'Operations', 'Administrative'
  ]::text[];

comment on column public.users.subscribed_task_types is
  'Task types the user is subscribed to. For role=team users, this filters which public tasks they see (in addition to tasks they''re directly involved in). Empty array = no type-based subscriptions.';
