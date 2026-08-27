-- Workstreams — replaces the Schedule tab and the legacy `milestones` table.
-- ⚠️ Run on Supabase. (Deploys do not touch the database.)
--
-- Hierarchy (see ROADMAP.md → Appendix A):
--   workstream (fixed: financial | technical | approvals; "Overview" is a view)
--     └─ major milestone      — FIXED BY THE BUILD, catalog rows, not user-editable
--          └─ sub-milestone   — user-editable; carries the real dates + dependencies
--               └─ sub-sub    — user-editable; 1-2 typical, DEPTH STOPS HERE
--
-- Deliberate design decisions:
--
-- 1. There are NO per-project rows for major milestones. A major exists purely
--    as a catalog row, and its window / status / progress are DERIVED from its
--    sub-milestones at read time. This makes "majors are not user-editable" a
--    structural guarantee rather than a UI rule, and means a new project needs
--    no milestone seeding at all.
--
-- 2. Majors carry a stable `key` shared by every project. That is what lets
--    Reports compare projects milestone-for-milestone across the portfolio, and
--    it only holds because users cannot rename them.
--
-- 3. Gates/objectives are catalog content (the same for every project); only
--    their per-project STATE lives in a project table.
--
-- 4. Depth is capped by trigger, not just by UI, so an import or a stray API
--    call cannot produce a third level that the roll-up queries can't handle.

-- ── Catalog: the fixed major milestones ───────────────────────────────
create table if not exists public.workstream_milestones (
  key         text primary key,
  workstream  text    not null check (workstream in ('financial', 'technical', 'approvals')),
  label       text    not null,
  description text,
  sort_order  integer not null default 0
);

comment on table public.workstream_milestones is
  'Build-owned catalog of major milestones. NOT user-editable: no UI writes here, and changing the list is a migration. The stable key is what lets Reports compare the same milestone across projects.';

-- ── Catalog: stage gates + key objectives per major ───────────────────
create table if not exists public.workstream_gates (
  id            uuid primary key default uuid_generate_v4(),
  milestone_key text    not null references public.workstream_milestones(key) on delete cascade,
  kind          text    not null check (kind in ('gate', 'objective')),
  label         text    not null,
  sort_order    integer not null default 0
);

create index if not exists workstream_gates_ms_idx on public.workstream_gates(milestone_key);

comment on table public.workstream_gates is
  'Build-owned stage gates and key objectives, attached to the MAJOR milestone (sub-milestones carry none). Per-project pass/fail state lives in workstream_gate_status.';

-- ── Per project: gate state ───────────────────────────────────────────
create table if not exists public.workstream_gate_status (
  project_id uuid not null references public.projects(id) on delete cascade,
  gate_id    uuid not null references public.workstream_gates(id) on delete cascade,
  status     text not null default 'open' check (status in ('open', 'pass', 'fail')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  primary key (project_id, gate_id)
);

create index if not exists workstream_gate_status_project_idx on public.workstream_gate_status(project_id);

comment on table public.workstream_gate_status is
  'Per-project state of a catalog gate/objective. Absent row = ''open'' (no need to seed on project create).';

-- ── Per project: sub-milestones (the action plan) ─────────────────────
-- These ARE the action-plan steps. parent_id gives the optional sub-sub level.
create table if not exists public.workstream_subs (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  milestone_key text not null references public.workstream_milestones(key),
  parent_id     uuid references public.workstream_subs(id) on delete cascade,
  depth         integer not null default 0 check (depth in (0, 1)),

  label       text not null,
  start_date  date,
  end_date    date,
  status      text not null default 'not_started'
              check (status in ('not_started', 'in_progress', 'blocked', 'at_risk', 'complete')),
  completed_at timestamptz,

  owner_id    uuid references public.users(id) on delete set null,
  co_owner_id uuid references public.users(id) on delete set null,

  notes text,   -- rich text (RichTextEditor HTML)
  risk  text,   -- rich text; presence is what renders the amber risk line

  sort_order integer not null default 0,   -- user-controlled priority order
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),

  -- a date range must not run backwards
  constraint workstream_subs_dates_ordered
    check (start_date is null or end_date is null or end_date >= start_date)
);

create index if not exists workstream_subs_project_idx  on public.workstream_subs(project_id);
create index if not exists workstream_subs_ms_idx       on public.workstream_subs(project_id, milestone_key);
create index if not exists workstream_subs_parent_idx   on public.workstream_subs(parent_id);

comment on table public.workstream_subs is
  'User-editable sub-milestones — these ARE the action-plan steps. Carry the real dates; the parent major derives its window/status from these. parent_id + depth give one optional level of sub-subs, capped by trigger.';
comment on column public.workstream_subs.depth is
  '0 = sub-milestone, 1 = sub-sub. Maintained by trigger from parent_id; never set it by hand.';
comment on column public.workstream_subs.sort_order is
  'User-controlled priority order within its parent (major, or sub for sub-subs). Drag-to-reprioritise writes this.';

-- Depth cap: a sub-sub cannot itself have children, and depth always tracks
-- parent_id. Enforced here so imports and direct API writes obey it too.
create or replace function public.workstream_subs_set_depth()
returns trigger as $$
declare
  parent_depth      integer;
  parent_project    uuid;
  parent_ms         text;
begin
  if new.parent_id is null then
    new.depth := 0;
    return new;
  end if;

  select depth, project_id, milestone_key
    into parent_depth, parent_project, parent_ms
    from public.workstream_subs
   where id = new.parent_id;

  if parent_depth is null then
    raise exception 'workstream_subs: parent % not found', new.parent_id;
  end if;

  if parent_depth >= 1 then
    raise exception 'workstream_subs: nesting is capped at one sub-sub level (parent % is already a sub-sub)', new.parent_id;
  end if;

  -- a child must not drift to a different project or major than its parent
  if parent_project <> new.project_id or parent_ms <> new.milestone_key then
    raise exception 'workstream_subs: child must share its parent''s project and milestone_key';
  end if;

  if new.id = new.parent_id then
    raise exception 'workstream_subs: a row cannot be its own parent';
  end if;

  new.depth := 1;
  return new;
end;
$$ language plpgsql;

drop trigger if exists workstream_subs_depth on public.workstream_subs;
create trigger workstream_subs_depth
  before insert or update of parent_id, project_id, milestone_key
  on public.workstream_subs
  for each row execute function public.workstream_subs_set_depth();

-- ── Per project: dependencies between sub-milestones ──────────────────
-- Edges live at the SUB level only; major-level dependencies are derived for
-- display and never stored. Edges may cross workstreams — that is exactly what
-- the Overview view draws.
create table if not exists public.workstream_sub_deps (
  sub_id     uuid not null references public.workstream_subs(id) on delete cascade,
  depends_on uuid not null references public.workstream_subs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sub_id, depends_on),
  constraint workstream_sub_deps_no_self check (sub_id <> depends_on)
);

create index if not exists workstream_sub_deps_sub_idx on public.workstream_sub_deps(sub_id);
create index if not exists workstream_sub_deps_dep_idx on public.workstream_sub_deps(depends_on);

comment on table public.workstream_sub_deps is
  'Predecessor edges between sub-milestones. May cross workstreams within a project. Cycles are rejected by trigger — critical-path and roll-up queries assume a DAG.';

-- Cycle prevention. Without this, a cycle makes the critical-path walk
-- non-terminating, so it is a correctness guard rather than a nicety.
create or replace function public.workstream_sub_deps_no_cycle()
returns trigger as $$
declare
  same_project boolean;
begin
  -- both ends must belong to the same project
  select a.project_id = b.project_id
    into same_project
    from public.workstream_subs a, public.workstream_subs b
   where a.id = new.sub_id and b.id = new.depends_on;

  if same_project is distinct from true then
    raise exception 'workstream_sub_deps: both ends must belong to the same project';
  end if;

  -- would adding sub_id -> depends_on close a loop? i.e. is sub_id already
  -- reachable by walking predecessors up from depends_on?
  if exists (
    with recursive walk(id) as (
      select new.depends_on
      union
      select d.depends_on
        from public.workstream_sub_deps d
        join walk w on d.sub_id = w.id
    )
    select 1 from walk where id = new.sub_id
  ) then
    raise exception 'workstream_sub_deps: this dependency would create a cycle';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists workstream_sub_deps_acyclic on public.workstream_sub_deps;
create trigger workstream_sub_deps_acyclic
  before insert or update on public.workstream_sub_deps
  for each row execute function public.workstream_sub_deps_no_cycle();

-- ── Per project: weekly updates ───────────────────────────────────────
-- Logged, never overwritten — the history is what feeds R-2 and R-8.
create table if not exists public.workstream_updates (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  workstream    text not null check (workstream in ('financial', 'technical', 'approvals')),
  milestone_key text references public.workstream_milestones(key) on delete set null,
  body          text not null,   -- rich text (RichTextEditor HTML, @-mentions inside)
  created_at    timestamptz not null default now(),
  created_by    uuid references public.users(id)
);

create index if not exists workstream_updates_project_idx on public.workstream_updates(project_id, created_at desc);
create index if not exists workstream_updates_ms_idx      on public.workstream_updates(project_id, milestone_key);

comment on table public.workstream_updates is
  'Append-only weekly PM updates. Never updated in place — the history is the point (feeds the priority dashboard and Reports).';

-- ── RLS — follows the 052 convention (authenticated read + write) ──────
alter table public.workstream_milestones   enable row level security;
alter table public.workstream_gates        enable row level security;
alter table public.workstream_gate_status  enable row level security;
alter table public.workstream_subs         enable row level security;
alter table public.workstream_sub_deps     enable row level security;
alter table public.workstream_updates      enable row level security;

-- Catalog tables are read-only to the app: select for authenticated, no write policy.
drop policy if exists workstream_milestones_select on public.workstream_milestones;
create policy workstream_milestones_select on public.workstream_milestones
  for select to authenticated using (true);

drop policy if exists workstream_gates_select on public.workstream_gates;
create policy workstream_gates_select on public.workstream_gates
  for select to authenticated using (true);

drop policy if exists workstream_gate_status_select on public.workstream_gate_status;
drop policy if exists workstream_gate_status_write  on public.workstream_gate_status;
create policy workstream_gate_status_select on public.workstream_gate_status for select to authenticated using (true);
create policy workstream_gate_status_write  on public.workstream_gate_status for all    to authenticated using (true) with check (true);

drop policy if exists workstream_subs_select on public.workstream_subs;
drop policy if exists workstream_subs_write  on public.workstream_subs;
create policy workstream_subs_select on public.workstream_subs for select to authenticated using (true);
create policy workstream_subs_write  on public.workstream_subs for all    to authenticated using (true) with check (true);

drop policy if exists workstream_sub_deps_select on public.workstream_sub_deps;
drop policy if exists workstream_sub_deps_write  on public.workstream_sub_deps;
create policy workstream_sub_deps_select on public.workstream_sub_deps for select to authenticated using (true);
create policy workstream_sub_deps_write  on public.workstream_sub_deps for all    to authenticated using (true) with check (true);

drop policy if exists workstream_updates_select on public.workstream_updates;
drop policy if exists workstream_updates_write  on public.workstream_updates;
create policy workstream_updates_select on public.workstream_updates for select to authenticated using (true);
create policy workstream_updates_write  on public.workstream_updates for all    to authenticated using (true) with check (true);

-- ── Seed the catalog ──────────────────────────────────────────────────
-- The 12 labels previously hardcoded as DEFAULT_MILESTONES in
-- src/app/api/projects/route.ts, split across the three workstreams, plus
-- "Development Budget Approved" (roadmap R-6). Labels are the user-visible
-- names; keys are permanent and safe to reference from code.
insert into public.workstream_milestones (key, workstream, label, sort_order) values
  ('site_assessment_complete',    'financial',  'Site Assessment Complete',          1),
  ('ppa_executed',                'financial',  'PPA / Contract Executed',           2),
  ('dev_budget_approved',         'financial',  'Development Budget Approved',       3),
  ('equipment_procurement',       'financial',  'Equipment Procurement',             4),

  ('feasibility_delivered',       'technical',  'Feasibility Report Delivered',      1),
  ('engineering_design_approved', 'technical',  'Engineering Design Approved',       2),
  ('construction_start',          'technical',  'Construction Start',                3),
  ('substantial_completion',      'technical',  'Substantial Completion',            4),

  ('interconnection_filed',       'approvals',  'Interconnection Application Filed', 1),
  ('permit_submitted',            'approvals',  'Permit Submitted',                  2),
  ('permit_approved',             'approvals',  'Permit Approved',                   3),
  ('interconnection_approved',    'approvals',  'Interconnection Approved',          4),
  ('pto_commercial_operation',    'approvals',  'PTO / Commercial Operation',        5)
on conflict (key) do update
  set workstream = excluded.workstream,
      label      = excluded.label,
      sort_order = excluded.sort_order;

-- Gates + objectives. First pass of content — deliberately light; refining these
-- is a content task (roadmap R-9 does the same job for as-built questions).
-- Re-runnable: keyed on (milestone_key, kind, label).
create unique index if not exists workstream_gates_unique
  on public.workstream_gates(milestone_key, kind, label);

insert into public.workstream_gates (milestone_key, kind, label, sort_order) values
  ('site_assessment_complete',    'gate',      'Signed site-assessment memo',                  1),
  ('site_assessment_complete',    'gate',      'Roof age and warranty confirmed',              2),
  ('site_assessment_complete',    'objective', 'Confirm the site can carry the array before spending on design', 1),

  ('ppa_executed',                'gate',      'Term sheet countersigned',                     1),
  ('ppa_executed',                'gate',      'Legal redlines closed',                        2),
  ('ppa_executed',                'gate',      'PPA fully executed',                           3),
  ('ppa_executed',                'objective', 'Reach signature before the utility interconnection window closes', 1),

  ('dev_budget_approved',         'gate',      'All site quotes uploaded',                     1),
  ('dev_budget_approved',         'gate',      'Budget signed off',                            2),
  ('dev_budget_approved',         'objective', 'Freeze the development budget before EPC bids go out', 1),

  ('equipment_procurement',       'gate',      'Module and inverter POs released',             1),
  ('equipment_procurement',       'objective', 'Lock module pricing before the tariff review date', 1),

  ('feasibility_delivered',       'gate',      'Production model signed off',                  1),
  ('feasibility_delivered',       'gate',      'Production estimate delivered',                2),
  ('feasibility_delivered',       'objective', 'Establish the production basis every downstream number depends on', 1),

  ('engineering_design_approved', 'gate',      '30% structural issued',                        1),
  ('engineering_design_approved', 'gate',      'IFC electrical stamped',                       2),
  ('engineering_design_approved', 'gate',      'Design revision frozen for the permit set',    3),
  ('engineering_design_approved', 'objective', 'Freeze the design so the permit set and the EPC bid set are the same drawings', 1),
  ('engineering_design_approved', 'objective', 'Close all Universal findings on the as-built review', 2),

  ('construction_start',          'gate',      'NTP issued',                                   1),
  ('construction_start',          'gate',      'All permits in hand',                          2),
  ('construction_start',          'objective', 'Mobilize inside the utility construction window', 1),

  ('substantial_completion',      'gate',      'Punchlist cleared',                            1),
  ('substantial_completion',      'gate',      'As-builts submitted',                          2),
  ('substantial_completion',      'objective', 'Reach substantial completion before the PTO window', 1),

  ('interconnection_filed',       'gate',      'Application accepted by utility',              1),
  ('interconnection_filed',       'gate',      'Study deposit paid',                           2),
  ('interconnection_filed',       'objective', 'Enter the queue before the cluster study cutoff', 1),

  ('permit_submitted',            'gate',      'Building permit submitted',                    1),
  ('permit_submitted',            'gate',      'Electrical permit submitted',                  2),
  ('permit_submitted',            'objective', 'Submit against a frozen drawing revision',     1),

  ('permit_approved',             'gate',      'All AHJ permits issued',                       1),
  ('permit_approved',             'gate',      'Zero open plan-review comments',               2),
  ('permit_approved',             'gate',      'Permit set matches the IFC revision',          3),
  ('permit_approved',             'objective', 'Clear the plan-review comment cycle in one pass', 1),
  ('permit_approved',             'objective', 'Lock the permit set before the EPC bid release', 2),

  ('interconnection_approved',    'gate',      'Signed interconnection agreement',             1),
  ('interconnection_approved',    'gate',      'Witness test scheduled',                       2),
  ('interconnection_approved',    'objective', 'Close interconnection before the PTO request', 1),

  ('pto_commercial_operation',    'gate',      'PTO letter received',                           1),
  ('pto_commercial_operation',    'gate',      'Revenue meter commissioned',                    2),
  ('pto_commercial_operation',    'objective', 'Reach commercial operation inside the PPA milestone date', 1)
on conflict (milestone_key, kind, label) do update
  set sort_order = excluded.sort_order;

-- ── Legacy `milestones` table ─────────────────────────────────────────
-- Intentionally NOT dropped. It is left in place, unread, for one release so the
-- old data is recoverable if anything about the Workstreams cutover is wrong.
-- A follow-up migration drops it. Nothing in the app reads it after this change.
comment on table public.milestones is
  'DEPRECATED as of migration 054 — superseded by workstream_milestones (catalog) + workstream_subs (per project). Left in place, unread, for one release; a follow-up migration drops it. Do not add readers.';
