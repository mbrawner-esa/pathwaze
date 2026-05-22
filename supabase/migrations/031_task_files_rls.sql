-- task_files: enable RLS + add policies so file uploads can actually persist.
--
-- Migration 002 created the table and set up policies on storage.objects
-- (the bucket), but never added policies on public.task_files itself. With
-- RLS on and no matching policy, inserts were silently rejected with
-- "new row violates row-level security policy for table 'task_files'".
--
-- For now we use permissive auth-only policies — any authenticated user can
-- create/read/delete file metadata. Per-task access checks can layer on
-- later via a USING clause that joins to the parent task's project_id.

alter table public.task_files enable row level security;

drop policy if exists task_files_select on public.task_files;
drop policy if exists task_files_write  on public.task_files;

create policy task_files_select
  on public.task_files
  for select
  to authenticated
  using (true);

create policy task_files_write
  on public.task_files
  for all
  to authenticated
  using (true)
  with check (true);
