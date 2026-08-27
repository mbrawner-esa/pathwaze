-- Department tags + the on-hold pause.
-- ⚠️ ALREADY RUN on Supabase (2026-08-26), while numbered 066.
--
-- Renamed 066 → 068 after the fact: 066 and 067 had already been taken by the
-- bug-batch branch, and this file was numbered from a stale CLAUDE.md rather
-- than from the directory. The content is unchanged and is live; the rename only
-- restores the "never reuse a number" rule so the ordering stays readable.
--
-- Part A — DEPARTMENTS. Tags on milestones and tasks naming which internal team
--   gets pulled in, so a team can see engagement coming before it lands
--   ("Engineering is needed for site walks in ~30 days"). Deliberately teams,
--   not people: the point is that Asset Management knows to expect involvement
--   without anyone having to guess which individual to name months ahead.
--
--   These are ESA org teams, NOT the nine task *types* (Design, Engineering,
--   Permitting, …). The lists overlap on "Engineering" and nowhere else — Asset
--   Management, Planning & Engagement, Real Estate and GIS have no task-type
--   equivalent — so reusing task type would have quietly lost four of the six.
--
-- Part B — ON HOLD. `projects.on_hold_at` records when a project was paused.
--   While it is set, the schedule stops driving anything: no variance, no
--   traffic light, no date-driven escalation. A held site would otherwise bleed
--   red purely because time keeps passing, which is noise on a decision that has
--   already been made.
--
--   Baselines are deliberately NOT cleared. They are the record of what was
--   originally committed, and after a hold they are also the record of what the
--   hold cost. Clearing them would destroy both.

-- ── Part A: departments ───────────────────────────────────────────────
create table if not exists public.departments (
  key        text primary key,
  name       text    not null,
  sort_order integer not null default 0
);

comment on table public.departments is
  'ESA internal teams that get tagged into milestones and tasks. Build-owned: changing the list is a migration, so reports can group by it across the portfolio.';

insert into public.departments (key, name, sort_order) values
  ('project_delivery',     'Project Delivery',     1),
  ('asset_management',     'Asset Management',     2),
  ('engineering',          'Engineering',          3),
  ('planning_engagement',  'Planning & Engagement', 4),
  ('real_estate',          'Real Estate',          5),
  ('gis',                  'GIS',                  6)
on conflict (key) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- Milestone tags. A milestone can pull in several teams at once (a site walk
-- needs Asset Management AND Engineering), hence many-to-many rather than a
-- single column.
create table if not exists public.workstream_milestone_departments (
  milestone_id   uuid not null references public.workstream_milestones(id) on delete cascade,
  department_key text not null references public.departments(key) on delete cascade,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.users(id),
  primary key (milestone_id, department_key)
);

create index if not exists ws_milestone_departments_ms_idx   on public.workstream_milestone_departments(milestone_id);
create index if not exists ws_milestone_departments_dept_idx on public.workstream_milestone_departments(department_key);

comment on table public.workstream_milestone_departments is
  'Which internal teams a milestone pulls in. Many-to-many: a site walk can need Asset Management and Engineering together.';

-- Task tags. Same idea one level down, so a specific piece of work can name its
-- team even when the parent milestone is broader.
create table if not exists public.task_departments (
  task_id        uuid not null references public.tasks(id) on delete cascade,
  department_key text not null references public.departments(key) on delete cascade,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.users(id),
  primary key (task_id, department_key)
);

create index if not exists task_departments_task_idx on public.task_departments(task_id);
create index if not exists task_departments_dept_idx on public.task_departments(department_key);

comment on table public.task_departments is
  'Which internal teams a task pulls in. Independent of the milestone tags: a broad milestone can carry one team while a task under it needs another.';

-- ── RLS — follows the 052 convention ──────────────────────────────────
alter table public.departments                        enable row level security;
alter table public.workstream_milestone_departments   enable row level security;
alter table public.task_departments                   enable row level security;

-- The catalog is read-only to the app: select only, no write policy.
drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments for select to authenticated using (true);

drop policy if exists ws_milestone_departments_select on public.workstream_milestone_departments;
drop policy if exists ws_milestone_departments_write  on public.workstream_milestone_departments;
create policy ws_milestone_departments_select on public.workstream_milestone_departments for select to authenticated using (true);
create policy ws_milestone_departments_write  on public.workstream_milestone_departments for all    to authenticated using (true) with check (true);

drop policy if exists task_departments_select on public.task_departments;
drop policy if exists task_departments_write  on public.task_departments;
create policy task_departments_select on public.task_departments for select to authenticated using (true);
create policy task_departments_write  on public.task_departments for all    to authenticated using (true) with check (true);

-- ── Part B: the on-hold marker ────────────────────────────────────────
alter table public.projects
  add column if not exists on_hold_at timestamptz;

comment on column public.projects.on_hold_at is
  'When the project was put On Hold. Set/cleared by the project API as stage moves in and out of ''On Hold''. While set, the schedule drives nothing: no variance, no traffic light, no date-driven escalation. Baselines are NOT cleared — they record both the original commitment and what the hold cost.';

-- Any project already sitting in On Hold gets a marker, so the pause takes
-- effect without someone having to re-save the stage.
update public.projects
   set on_hold_at = coalesce(on_hold_at, now())
 where stage = 'On Hold' and on_hold_at is null;

-- And a project NOT on hold must not carry a stale marker.
update public.projects
   set on_hold_at = null
 where stage <> 'On Hold' and on_hold_at is not null;

do $$
declare
  held integer;
  depts integer;
begin
  select count(*) into held from public.projects where on_hold_at is not null;
  select count(*) into depts from public.departments;
  raise notice 'Departments seeded: %. Projects currently on hold: %.', depts, held;
end $$;
