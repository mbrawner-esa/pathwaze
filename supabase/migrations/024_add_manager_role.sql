-- Add 'manager' role to the users.role enum.
--
-- Permission model (enforced in application code via src/lib/permissions.ts):
--   admin   — full access, can delete + archive projects
--   manager — sees all projects and tasks, edits everything, but CANNOT
--             delete or archive projects
--   team    — sees all projects, sees own + subscribed-task-type tasks
--             (subscription system added in a later migration)
--   investor— investor portal only (existing)
--
-- This migration is just the schema change. UI + API enforcement is in code.

alter table public.users drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'manager', 'team', 'investor'));

-- Same constraint on the invited_emails table so admins can invite managers.
alter table public.invited_emails drop constraint if exists invited_emails_role_check;
