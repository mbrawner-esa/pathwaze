-- Real Technical workstream content, from Workstream_Outline.docx (2026-08-25).
-- ⚠️ Run on Supabase. (Deploys do not touch the database.)
--
-- Replaces the placeholder Technical majors with the six real stages, and adds
-- MILESTONE TEMPLATES so a new project starts with the standard plan instead of
-- every PM retyping it across 19 projects.
--
--   Conceptual Design       P1 Preliminary Design 50 · P2 Facility Feedback Meeting 50
--   Site Feasibility        P1 As-Built Review 50 · P2 Site Investigation 30 · P3 Final Feasibility Report 20
--   Design Development      P1-P4 at 25 each
--   Late-Stage Development  P1 Scope Refinement 10 · P2 EPC Review 10 · P3 Site Due Diligence 50 · P4 Final Engineering Issued 30
--   Pre-Construction        (no detail yet)
--   Construction            (no detail yet)
--
-- Notes on the source document:
--  * The "P1 –" prefixes are dropped from the labels. The UI already numbers
--    milestones P1/P2/P3 from sort_order, so keeping them would read "P1 P1 – …".
--  * The Critical Path column was blank for every detailed milestone, so nothing
--    is seeded as critical. PMs can tick the flag per project.
--  * Financial and Approvals still carry PLACEHOLDER majors from migration 054,
--    pending their own outlines.

-- ── Purge branch test data ────────────────────────────────────────────
-- Everything entered into Workstreams so far was test data on the feature
-- branch (confirmed 2026-08-25). It has to go before the placeholder majors can
-- be retired: the guard further down refuses to drop a major that still has
-- milestones under it, and the test rows sit under exactly those majors.
--
-- Scoped to Workstreams only. The single task delete covers tasks created under
-- a test milestone; no other task is touched.
delete from public.tasks where workstream_milestone_id is not null;
delete from public.workstream_milestones;   -- cascades workstream_milestone_deps
delete from public.workstream_updates;
delete from public.workstream_major_state;

-- ── Milestone templates ───────────────────────────────────────────────
-- Mirrors workstream_gate_templates: build-owned starting content, copied into
-- each project where it becomes fully editable.
create table if not exists public.workstream_milestone_templates (
  id          uuid primary key default uuid_generate_v4(),
  major_key   text    not null references public.workstream_majors(key) on delete cascade,
  label       text    not null,
  description text,
  stage_gate  text,
  weight_pct  numeric(5,2) not null default 0 check (weight_pct >= 0 and weight_pct <= 100),
  is_critical boolean not null default false,
  sort_order  integer not null default 0
);

create unique index if not exists workstream_milestone_templates_unique
  on public.workstream_milestone_templates(major_key, label);

alter table public.workstream_milestone_templates enable row level security;
drop policy if exists workstream_milestone_templates_select on public.workstream_milestone_templates;
create policy workstream_milestone_templates_select on public.workstream_milestone_templates
  for select to authenticated using (true);

comment on table public.workstream_milestone_templates is
  'Standard milestones per major, copied into each project on create (and backfilled below). Editing happens on the per-project workstream_milestones rows, never here.';

-- ── Retire the placeholder Technical majors ───────────────────────────
-- Non-destructive: a major is only removed when no project has milestones under
-- it. workstream_milestones.major_key has no ON DELETE action, so a blind delete
-- would either error or need to destroy real plans — neither is acceptable.
do $$
declare
  retiring text[] := array[
    'feasibility_delivered', 'engineering_design_approved',
    'construction_start', 'substantial_completion'
  ];
  k text;
  in_use integer;
begin
  foreach k in array retiring loop
    select count(*) into in_use
      from public.workstream_milestones where major_key = k;

    if in_use > 0 then
      raise notice 'Keeping % — % milestone(s) still reference it. Move or delete them, then re-run.', k, in_use;
    else
      -- gates and gate templates cascade from workstream_majors
      delete from public.workstream_majors where key = k;
    end if;
  end loop;
end $$;

-- ── The six real Technical majors ─────────────────────────────────────
insert into public.workstream_majors (key, workstream, label, sort_order) values
  ('conceptual_design',      'technical', 'Conceptual Design',      1),
  ('site_feasibility',       'technical', 'Site Feasibility',       2),
  ('design_development',     'technical', 'Design Development',     3),
  ('late_stage_development', 'technical', 'Late-Stage Development', 4),
  ('pre_construction',       'technical', 'Pre-Construction',       5),
  ('construction',           'technical', 'Construction',           6)
on conflict (key) do update
  set workstream = excluded.workstream,
      label      = excluded.label,
      sort_order = excluded.sort_order;

-- ── Stage gates + key objectives ──────────────────────────────────────
insert into public.workstream_gate_templates (major_key, kind, label, sort_order) values
  -- Conceptual Design
  ('conceptual_design', 'gate',      'Facility Leadership Approval',                                   1),
  ('conceptual_design', 'objective', 'Present Phase II designs',                                      1),
  ('conceptual_design', 'objective', 'Solicit facility and stakeholder feedback',                      2),
  ('conceptual_design', 'objective', 'Revise designs based on future plans and existing conditions',   3),

  -- Site Feasibility
  ('site_feasibility', 'gate',      'Post Site Survey Risk Report Delivered',                          1),
  ('site_feasibility', 'objective', 'Review existing conditions and as-builts to flag documentation gaps', 1),
  ('site_feasibility', 'objective', 'Develop scope of on-site surveys',                                2),
  ('site_feasibility', 'objective', 'Obtain Third Party Risk Assessment',                              3),

  -- Design Development
  ('design_development', 'gate',      'Preliminary Engineering',                                       1),
  ('design_development', 'gate',      'Facility Leadership Approval',                                  2),
  ('design_development', 'objective', 'Utilize feasibility report to guide the engineering and project requirements', 1),
  ('design_development', 'objective', 'Incorporate Utility requirements for Interconnection',          2),
  ('design_development', 'objective', 'Incorporate AHJ requirements for Construction',                 3),

  -- Late-Stage Development
  ('late_stage_development', 'gate',      'Final Engineering Issued',                                  1),
  ('late_stage_development', 'objective', 'Finalize drawings to incorporate final engineering studies and site conditions', 1),
  ('late_stage_development', 'objective', 'Clarify construction approach, equipment requirements and project schedule.',   2)
on conflict (major_key, kind, label) do update
  set sort_order = excluded.sort_order;

-- ── Milestone templates ───────────────────────────────────────────────
insert into public.workstream_milestone_templates (major_key, label, description, weight_pct, sort_order) values
  ('conceptual_design', 'Preliminary Design',
   'Revise Phase II design based on current design requirements and system size limits.', 50, 1),
  ('conceptual_design', 'Facility Feedback Meeting',
   'Engage key stakeholders to solicit design feedback and overall project requirements.', 50, 2),

  ('site_feasibility', 'As-Built Review',
   'Obtain as-built documentation, warranty, and existing conditions information. Complete thorough review to identify key risks.', 50, 1),
  ('site_feasibility', 'Site Investigation',
   'Execute on-site survey and site walk to determine feasibility and meet with facility staff to inspect physical conditions.', 30, 2),
  ('site_feasibility', 'Final Feasibility Report',
   'Incorporate final report.', 20, 3),

  ('design_development', 'Project Specifications',
   'Develop project specifications for interconnection, product selection, facility requirements and technical requirements.', 25, 1),
  ('design_development', 'Code Compliance Review',
   'Complete internal and external review of design specifications with applicable codes and standards.', 25, 2),
  ('design_development', 'Preliminary Engineering Issued',
   'Develop initial drafts, with client feedback and external review to ensure compliance with specifications.', 25, 3),
  ('design_development', 'Final Design Approval',
   'Obtain final approval from client stakeholder team.', 25, 4),

  ('late_stage_development', 'Scope Refinement',
   'Develop full project specifications package for engineering and construction based on final design.', 10, 1),
  ('late_stage_development', 'EPC Review',
   'Review RFIs and clarifications from contractors, coordinate on-site construction walks and scope review as needed.', 10, 2),
  ('late_stage_development', 'Site Due Diligence',
   'Release third party surveyors for late-stage development detail (geotechnical, reactions analysis, topographic studies, etc).', 50, 3),
  ('late_stage_development', 'Final Engineering Issued',
   'Incorporate third party surveys, contractors'' clarifications and final engineering to complete site plan.', 30, 4)
on conflict (major_key, label) do update
  set description = excluded.description,
      weight_pct  = excluded.weight_pct,
      sort_order  = excluded.sort_order;

-- ── Backfill existing projects ────────────────────────────────────────
-- Gates: insert only what is missing, so edited/deleted gates are left alone.
insert into public.workstream_gates (project_id, major_key, kind, label, sort_order)
select p.id, t.major_key, t.kind, t.label, t.sort_order
  from public.projects p
 cross join public.workstream_gate_templates t
 where not exists (
   select 1 from public.workstream_gates g
    where g.project_id = p.id and g.major_key = t.major_key
      and g.kind = t.kind and g.label = t.label
 );

-- Milestones: skip any major where the project already has a plan, so a PM's
-- work is never duplicated or overwritten. All-or-nothing per (project, major)
-- deliberately — half-seeding a partly-built plan would corrupt its weights.
insert into public.workstream_milestones
  (project_id, major_key, label, description, stage_gate, weight_pct, is_critical, sort_order)
select p.id, t.major_key, t.label, t.description, t.stage_gate,
       t.weight_pct, t.is_critical, t.sort_order
  from public.projects p
 cross join public.workstream_milestone_templates t
 where not exists (
   select 1 from public.workstream_milestones m
    where m.project_id = p.id and m.major_key = t.major_key
 );
