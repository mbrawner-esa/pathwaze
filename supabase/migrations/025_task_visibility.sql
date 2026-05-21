-- Task visibility: public (default, team-visible) or private (only the creator).
-- Private tasks act as personal reminders (Asana-style) — invisible to everyone
-- else regardless of role, including admins and managers. Project field is
-- still allowed on private tasks if the user wants to scope a personal note
-- to a specific project.

alter table public.tasks
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private'));

comment on column public.tasks.visibility is 'public = visible per role/subscription rules. private = only the creator (created_by) can see it.';

-- Index helps the visibility filter applied to every task list query.
create index if not exists tasks_visibility_idx on public.tasks(visibility);
