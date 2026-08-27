-- Baseline vs target dates, and cross-workstream exit-gate links.
-- ⚠️ Run on Supabase, after 058. (Deploys do not touch the database.)
--
-- Part A — dates. Milestones lose their start date and keep a single TARGET
--   date, plus a BASELINE date that records where the milestone was originally
--   scheduled to land. The target moves as reality moves; the baseline does not.
--   The gap between them is slip, and slip against the original commitment is
--   the risk signal — not "is it past due today", which only fires once it is
--   already too late to react.
--
--   The baseline auto-captures the first target ever set (see the API), so it
--   costs nobody an extra field, and it then locks: only an admin can change a
--   baseline once recorded. "Locked" is simply "already has a value", which is
--   cheaper than a separate flag that can drift out of sync with the date.
--
-- Part B — exit gate links. An exit gate can require milestones from ANY
--   workstream: the Legal RFP-pricing milestone gating on Technical's final
--   design, for example. This is the first cross-workstream dependency the team
--   actually asked for, and it is deliberately advisory — passing a gate with an
--   open requirement warns loudly rather than refusing, because a gate is a
--   judgement call and a hard block would just get worked around.

-- ── Part A: target + baseline dates ───────────────────────────────────
alter table public.workstream_milestones
  add column if not exists baseline_date date;

-- The date-order check exists only to relate start_date to end_date, so it goes
-- with the column. (Postgres would drop it automatically; explicit is clearer.)
alter table public.workstream_milestones
  drop constraint if exists workstream_milestones_dates_ordered;

-- Seed the baseline from any target already recorded, so existing rows start
-- with baseline = target (zero slip) rather than a null that reads as "never
-- scheduled".
update public.workstream_milestones
   set baseline_date = end_date
 where baseline_date is null and end_date is not null;

alter table public.workstream_milestones
  drop column if exists start_date;

comment on column public.workstream_milestones.end_date is
  'Target completion date. Moves as the plan moves.';
comment on column public.workstream_milestones.baseline_date is
  'Originally scheduled completion. Auto-captured from the first target set, then locked — only an admin may change it. target - baseline = slip.';

-- ── Part B: exit gate → milestone links ───────────────────────────────
create table if not exists public.workstream_gate_links (
  gate_id      uuid not null references public.workstream_gates(id) on delete cascade,
  milestone_id uuid not null references public.workstream_milestones(id) on delete cascade,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.users(id),
  primary key (gate_id, milestone_id)
);

create index if not exists workstream_gate_links_gate_idx      on public.workstream_gate_links(gate_id);
create index if not exists workstream_gate_links_milestone_idx on public.workstream_gate_links(milestone_id);

comment on table public.workstream_gate_links is
  'Milestones an exit gate depends on. May cross workstreams — this is the cross-workstream dependency mechanism. Advisory: the UI warns when a gate is passed with an open requirement, it does not block.';

-- Both ends must belong to the same project. Nothing in the schema otherwise
-- prevents linking a gate to another project's milestone, and a cross-project
-- link would silently corrupt every roll-up that reads it.
create or replace function public.workstream_gate_links_same_project()
returns trigger as $$
declare
  ok boolean;
begin
  select g.project_id = m.project_id
    into ok
    from public.workstream_gates g, public.workstream_milestones m
   where g.id = new.gate_id and m.id = new.milestone_id;

  if ok is distinct from true then
    raise exception 'workstream_gate_links: gate and milestone must belong to the same project';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists workstream_gate_links_project on public.workstream_gate_links;
create trigger workstream_gate_links_project
  before insert or update on public.workstream_gate_links
  for each row execute function public.workstream_gate_links_same_project();

alter table public.workstream_gate_links enable row level security;

drop policy if exists workstream_gate_links_select on public.workstream_gate_links;
drop policy if exists workstream_gate_links_write  on public.workstream_gate_links;
create policy workstream_gate_links_select on public.workstream_gate_links for select to authenticated using (true);
create policy workstream_gate_links_write  on public.workstream_gate_links for all    to authenticated using (true) with check (true);
