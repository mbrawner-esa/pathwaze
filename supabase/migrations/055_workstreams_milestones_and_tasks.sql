-- Workstreams, revision 2 — renames the hierarchy and makes the bottom level
-- real tasks. Builds on 054, which is already applied.
-- ⚠️ Run on Supabase. (Deploys do not touch the database.)
--
-- What changes and why:
--
--   054 shipped:  major (catalog) → sub-milestone → sub-sub
--   055 ships:    MAJOR MILESTONE (catalog, per-project owners)
--                   → MILESTONE (user-created: dates, stage gate, weight, critical flag)
--                     → TASK (a real `tasks` row, so it appears in /tasks like any work)
--
-- 1. A milestone is NOT a task. Milestones are planning checkpoints; the work
--    under them is ordinary tasks. That keeps one definition of "work assigned
--    to me" in the product instead of a second, invisible one.
-- 2. Ownership moves UP: majors get an owner + co-owner (author / co-author of
--    that section). Milestones no longer carry owners — their tasks do.
-- 3. Progress becomes WEIGHTED: each milestone declares what % of its major it
--    represents.
-- 4. Critical path becomes a user-declared flag rather than a derived path.
-- 5. Stage gates and key objectives become per-project and editable; the 054
--    catalog rows become templates that seed each project.
--
-- Existing data is preserved: 054's sub-milestones become milestones, and any
-- sub-subs become tasks linked to their parent milestone.
--
-- Table renames are wrapped in existence guards so the whole file is re-runnable.

-- ── 1. Free up the names, in dependency order ─────────────────────────
do $$
begin
  -- catalog gates become templates (frees `workstream_gates` for per-project rows)
  if to_regclass('public.workstream_gates') is not null
     and to_regclass('public.workstream_gate_templates') is null then
    alter table public.workstream_gates rename to workstream_gate_templates;
  end if;

  -- catalog majors take their real name (frees `workstream_milestones`)
  if to_regclass('public.workstream_milestones') is not null
     and to_regclass('public.workstream_majors') is null then
    alter table public.workstream_milestones rename to workstream_majors;
  end if;

  -- sub-milestones become milestones
  if to_regclass('public.workstream_subs') is not null
     and to_regclass('public.workstream_milestones') is null then
    alter table public.workstream_subs rename to workstream_milestones;
  end if;

  if to_regclass('public.workstream_sub_deps') is not null
     and to_regclass('public.workstream_milestone_deps') is null then
    alter table public.workstream_sub_deps rename to workstream_milestone_deps;
  end if;
end $$;

-- ── 2. Rename columns to match the new vocabulary ─────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='workstream_gate_templates' and column_name='milestone_key') then
    alter table public.workstream_gate_templates rename column milestone_key to major_key;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='workstream_milestones' and column_name='milestone_key') then
    alter table public.workstream_milestones rename column milestone_key to major_key;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='workstream_milestone_deps' and column_name='sub_id') then
    alter table public.workstream_milestone_deps rename column sub_id to milestone_id;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='workstream_updates' and column_name='milestone_key') then
    alter table public.workstream_updates rename column milestone_key to major_key;
  end if;
end $$;

-- ── 3. Retire the depth machinery from 054 ────────────────────────────
-- The third level is now `tasks`, so the depth cap has nothing left to guard.
drop trigger  if exists workstream_subs_depth on public.workstream_milestones;
drop function if exists public.workstream_subs_set_depth();

-- ── 4. Tasks become the work under a milestone ────────────────────────
alter table public.tasks
  add column if not exists workstream_milestone_id uuid
    references public.workstream_milestones(id) on delete set null;

-- Needed to order "recently completed" work in the updates feed. Tasks had only
-- a status, so there was no way to sort by when they finished.
alter table public.tasks
  add column if not exists completed_at timestamptz;

create index if not exists tasks_workstream_milestone_idx on public.tasks(workstream_milestone_id);

-- Approximate backfill: tasks already complete get their created_at, since
-- there is no real completion time to recover.
update public.tasks
   set completed_at = created_at
 where status = 'Complete' and completed_at is null;

comment on column public.tasks.workstream_milestone_id is
  'Optional link to the Workstreams milestone this task delivers. Nullable — most tasks have no milestone.';
comment on column public.tasks.completed_at is
  'Set when status becomes Complete, cleared when reopened. Backfilled from created_at for tasks already complete at migration time.';

-- ── 5. Convert 054 sub-subs into real tasks ───────────────────────────
-- A sub-sub was a work item in all but name, which is exactly what this change
-- recognises. Each becomes a task linked to its former parent.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='workstream_milestones' and column_name='parent_id') then

    insert into public.tasks
      (project_id, title, description, type, status, priority, due_date,
       workstream_milestone_id, completed_at, created_by, visibility)
    select m.project_id,
           m.label,
           m.notes,
           'Administrative',
           case when m.status = 'complete' then 'Complete' else 'Draft' end,
           'Medium',
           m.end_date,
           m.parent_id,
           case when m.status = 'complete' then coalesce(m.completed_at, now()) end,
           m.created_by,
           'public'
      from public.workstream_milestones m
     where m.parent_id is not null;

    delete from public.workstream_milestones where parent_id is not null;

    alter table public.workstream_milestones drop column parent_id;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='workstream_milestones' and column_name='depth') then
    alter table public.workstream_milestones drop column depth;
  end if;
end $$;

-- ── 6. Major milestone ownership (per project) ────────────────────────
create table if not exists public.workstream_major_state (
  project_id    uuid not null references public.projects(id) on delete cascade,
  major_key     text not null references public.workstream_majors(key) on delete cascade,
  owner_id      uuid references public.users(id) on delete set null,
  co_owner_id   uuid references public.users(id) on delete set null,
  -- Set the first time the major is seen complete, so the completion
  -- celebration fires once rather than on every page load.
  celebrated_at timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (project_id, major_key)
);

create index if not exists workstream_major_state_project_idx on public.workstream_major_state(project_id);

comment on table public.workstream_major_state is
  'Per-project owner/co-owner of a major milestone ("author and co-author" of that section), plus the one-shot completion-celebration marker. Absent row = unowned.';

-- Carry ownership up from 054's sub-milestones: the first owner found under a
-- major becomes that major's owner, so nothing set during testing is lost.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='workstream_milestones' and column_name='owner_id') then

    insert into public.workstream_major_state (project_id, major_key, owner_id, co_owner_id)
    select distinct on (project_id, major_key)
           project_id, major_key, owner_id, co_owner_id
      from public.workstream_milestones
     where owner_id is not null or co_owner_id is not null
     order by project_id, major_key, sort_order
    on conflict (project_id, major_key) do nothing;

    alter table public.workstream_milestones drop column owner_id;
    alter table public.workstream_milestones drop column co_owner_id;
  end if;
end $$;

-- ── 7. New milestone fields ───────────────────────────────────────────
alter table public.workstream_milestones
  add column if not exists description text,
  add column if not exists stage_gate  text,
  add column if not exists weight_pct  numeric(5,2) not null default 0,
  add column if not exists is_critical boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workstream_milestones_weight_range') then
    alter table public.workstream_milestones
      add constraint workstream_milestones_weight_range
      check (weight_pct >= 0 and weight_pct <= 100);
  end if;
end $$;

comment on column public.workstream_milestones.weight_pct is
  'Share of the parent major this milestone represents, 0-100. Weighted progress; the UI falls back to equal weighting when a major has no weights set, and flags a major whose weights do not total 100.';
comment on column public.workstream_milestones.is_critical is
  'User-declared critical path. Deliberately a flag rather than a derived longest-path: PMs mark what they know matters.';
comment on column public.workstream_milestones.stage_gate is
  'What "done" means for this milestone, in the PM''s words. Distinct from the major''s stage gates, which are the gate out of the whole stage.';
comment on table public.workstream_milestones is
  'User-created milestones under a major. Planning checkpoints, NOT work items — the work lives in `tasks` linked via tasks.workstream_milestone_id.';

-- ── 8. Per-project, editable gates + objectives ───────────────────────
create table if not exists public.workstream_gates (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid    not null references public.projects(id) on delete cascade,
  major_key  text    not null references public.workstream_majors(key) on delete cascade,
  kind       text    not null check (kind in ('gate', 'objective')),
  label      text    not null,
  status     text    not null default 'open' check (status in ('open', 'pass', 'fail')),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

create index if not exists workstream_gates_project_idx on public.workstream_gates(project_id, major_key);

comment on table public.workstream_gates is
  'Per-project stage gates and key objectives on a MAJOR milestone. Fully user-editable — seeded from workstream_gate_templates.';

-- Copy the templates into every existing project. Only inserts what is missing,
-- so a project whose gates have been edited or deleted is left alone.
insert into public.workstream_gates (project_id, major_key, kind, label, sort_order)
select p.id, t.major_key, t.kind, t.label, t.sort_order
  from public.projects p
 cross join public.workstream_gate_templates t
 where not exists (
   select 1 from public.workstream_gates g
    where g.project_id = p.id
      and g.major_key  = t.major_key
      and g.kind       = t.kind
      and g.label      = t.label
 );

-- Carry over any pass/fail state recorded against 054's catalog gates.
do $$
begin
  if to_regclass('public.workstream_gate_status') is not null then
    update public.workstream_gates g
       set status = s.status
      from public.workstream_gate_status s
      join public.workstream_gate_templates t on t.id = s.gate_id
     where g.project_id = s.project_id
       and g.major_key  = t.major_key
       and g.kind       = t.kind
       and g.label      = t.label;

    drop table public.workstream_gate_status;
  end if;
end $$;

comment on table public.workstream_gate_templates is
  'Starting set of gates/objectives copied into each project. Editing happens on the per-project workstream_gates rows, never here.';

-- ── 9. Cycle guard, renamed to match ──────────────────────────────────
drop trigger  if exists workstream_sub_deps_acyclic on public.workstream_milestone_deps;
drop function if exists public.workstream_sub_deps_no_cycle();

create or replace function public.workstream_milestone_deps_no_cycle()
returns trigger as $$
declare
  same_project boolean;
begin
  select a.project_id = b.project_id
    into same_project
    from public.workstream_milestones a, public.workstream_milestones b
   where a.id = new.milestone_id and b.id = new.depends_on;

  if same_project is distinct from true then
    raise exception 'workstream_milestone_deps: both ends must belong to the same project';
  end if;

  if exists (
    with recursive walk(id) as (
      select new.depends_on
      union
      select d.depends_on
        from public.workstream_milestone_deps d
        join walk w on d.milestone_id = w.id
    )
    select 1 from walk where id = new.milestone_id
  ) then
    raise exception 'workstream_milestone_deps: this dependency would create a cycle';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists workstream_milestone_deps_acyclic on public.workstream_milestone_deps;
create trigger workstream_milestone_deps_acyclic
  before insert or update on public.workstream_milestone_deps
  for each row execute function public.workstream_milestone_deps_no_cycle();

-- ── 10. RLS for the tables that are new or renamed ────────────────────
alter table public.workstream_majors          enable row level security;
alter table public.workstream_major_state     enable row level security;
alter table public.workstream_gate_templates  enable row level security;
alter table public.workstream_gates           enable row level security;
alter table public.workstream_milestones      enable row level security;
alter table public.workstream_milestone_deps  enable row level security;

-- Catalog tables stay read-only to the app: select only, no write policy.
drop policy if exists workstream_milestones_select on public.workstream_majors;
drop policy if exists workstream_majors_select     on public.workstream_majors;
create policy workstream_majors_select on public.workstream_majors
  for select to authenticated using (true);

drop policy if exists workstream_gates_select          on public.workstream_gate_templates;
drop policy if exists workstream_gate_templates_select on public.workstream_gate_templates;
create policy workstream_gate_templates_select on public.workstream_gate_templates
  for select to authenticated using (true);

drop policy if exists workstream_major_state_select on public.workstream_major_state;
drop policy if exists workstream_major_state_write  on public.workstream_major_state;
create policy workstream_major_state_select on public.workstream_major_state for select to authenticated using (true);
create policy workstream_major_state_write  on public.workstream_major_state for all    to authenticated using (true) with check (true);

drop policy if exists workstream_gates_select on public.workstream_gates;
drop policy if exists workstream_gates_write  on public.workstream_gates;
create policy workstream_gates_select on public.workstream_gates for select to authenticated using (true);
create policy workstream_gates_write  on public.workstream_gates for all    to authenticated using (true) with check (true);

-- The renamed tables carried their 054 policies across, but the policy names
-- referred to the old table names. Re-create them cleanly.
drop policy if exists workstream_subs_select       on public.workstream_milestones;
drop policy if exists workstream_subs_write        on public.workstream_milestones;
drop policy if exists workstream_milestones_write  on public.workstream_milestones;
create policy workstream_milestones_select on public.workstream_milestones for select to authenticated using (true);
create policy workstream_milestones_write  on public.workstream_milestones for all    to authenticated using (true) with check (true);

drop policy if exists workstream_sub_deps_select       on public.workstream_milestone_deps;
drop policy if exists workstream_sub_deps_write        on public.workstream_milestone_deps;
drop policy if exists workstream_milestone_deps_select on public.workstream_milestone_deps;
drop policy if exists workstream_milestone_deps_write  on public.workstream_milestone_deps;
create policy workstream_milestone_deps_select on public.workstream_milestone_deps for select to authenticated using (true);
create policy workstream_milestone_deps_write  on public.workstream_milestone_deps for all    to authenticated using (true) with check (true);
