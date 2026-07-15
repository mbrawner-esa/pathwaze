-- Subtasks — 2-level task hierarchy. A task may have child subtasks (full tasks
-- in their own right: own assignee/status/due/priority), but a subtask cannot
-- itself have subtasks. Deleting a parent cascades to its subtasks.
--
-- (Schedule-tab columns are intentionally NOT included here — that feature is
-- still being scoped separately.)
-- ⚠️ Run on Supabase.

alter table public.tasks
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;

create index if not exists tasks_parent_task_idx on public.tasks(parent_task_id);

-- Enforce 2-level nesting: parent_task_id must point at a TOP-LEVEL task.
create or replace function public.enforce_task_2_level_nesting()
returns trigger as $func$
begin
  if new.parent_task_id is not null then
    if exists (
      select 1 from public.tasks
      where id = new.parent_task_id and parent_task_id is not null
    ) then
      raise exception 'Subtasks cannot have their own subtasks (2-level nesting limit)';
    end if;
  end if;
  return new;
end;
$func$ language plpgsql;

drop trigger if exists enforce_task_nesting on public.tasks;
create trigger enforce_task_nesting
  before insert or update on public.tasks
  for each row execute function public.enforce_task_2_level_nesting();
