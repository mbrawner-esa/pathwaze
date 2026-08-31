-- Remove the /health sample project created by scripts/seed-test-project.sql.
--
-- Scoped to project_number 'TEST-0001' and nothing else. Milestones, major
-- state, and the portfolio_priority row all cascade or are cleared explicitly,
-- so nothing is left pointing at a project that no longer exists.

do $$
declare pid uuid;
begin
  select id into pid from public.projects where project_number = 'TEST-0001';

  if pid is null then
    raise notice 'No TEST-0001 project found — nothing to remove.';
    return;
  end if;

  -- portfolio_priority cascades on project delete, but clearing it first keeps
  -- the remaining ranks meaningful if someone re-runs the seed later.
  delete from public.portfolio_priority       where project_id = pid;
  delete from public.workstream_milestones    where project_id = pid;
  delete from public.workstream_major_state   where project_id = pid;
  delete from public.projects                 where id = pid;

  raise notice 'Removed ZZ TEST — Sample Hospital (%).', pid;
end $$;
