-- Drop "at risk" from milestone status, and let deal health be overridden.
-- ⚠️ Run on Supabase, after 062. (Deploys do not touch the database.)
--
-- Part A — milestone status loses 'at_risk'.
--   The dates already answer "is this at risk": a target that has moved past its
--   baseline, or one that lands inside a week, is what at-risk actually means,
--   and the traffic light derives both. Keeping a manual at_risk alongside them
--   meant two sources for the same claim that could disagree, with no way to
--   tell which was right.
--
--   What remains is what a person genuinely knows and the dates cannot infer:
--     not_started | in_progress | blocked | complete
--
--   Existing at_risk rows become in_progress — the work is under way, and the
--   risk itself is now expressed by the schedule.
--
-- Part B — projects.deal_health_override.
--   Workstreams suggest a deal health, but majors move and the suggestion will
--   sometimes be wrong or simply not worth acting on. The override records that
--   a human has decided, so the nudge stops asking. It is a marker, not a second
--   value: deal_health itself remains the single source of truth.

-- ── Part A: milestone status ─────────────────────────────────────────
update public.workstream_milestones
   set status = 'in_progress'
 where status = 'at_risk';

-- The constraint was created inline in 054, so its generated name still carries
-- the ORIGINAL table name (workstream_subs). Find it by definition.
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'workstream_milestones'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%at_risk%'
  loop
    execute format('alter table public.workstream_milestones drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.workstream_milestones
  add constraint workstream_milestones_status_check
  check (status in ('not_started', 'in_progress', 'blocked', 'complete'));

comment on column public.workstream_milestones.status is
  'What a person knows that the dates cannot infer: not_started | in_progress | blocked | complete. Schedule risk is derived from baseline vs target, not set by hand.';

-- ── Part B: deal health override ─────────────────────────────────────
alter table public.projects
  add column if not exists deal_health_override boolean not null default false;

comment on column public.projects.deal_health_override is
  'True when someone has deliberately set deal_health against what the workstreams suggest. Suppresses the suggestion prompt until cleared. deal_health remains the single source of truth; this only records that the disagreement is intentional.';

do $$
declare
  moved integer;
begin
  select count(*) into moved from public.workstream_milestones where status = 'in_progress';
  raise notice 'Milestones now in_progress (includes any converted from at_risk): %', moved;
end $$;
