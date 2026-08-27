-- Approvals workstream content.
-- ⚠️ Run on Supabase, after 059. (Deploys do not touch the database.)
--
-- Completes the third workstream. Six majors, in the order the approvals run:
--   1 Governing Requirements and Code Review
--   2 Utility Approval
--   3 Discretionary Permits Approved
--   4 Ministerial Permits Approved
--   5 AHCA Approval            — Florida only, see the note below
--   6 Notice to Proceed
--
-- Two majors are deliberately left thin. Discretionary and ministerial permit
-- scope varies enormously per site — most behind-the-meter rooftop arrays are
-- by-right, so a fixed set of filing/hearing milestones would be wrong on more
-- sites than it was right on. Each therefore seeds a single scope-confirmation
-- milestone, and PMs add the real filings once the matrix says what a given AHJ
-- actually requires.
--
-- ⚠️ AHCA IS FLORIDA ONLY. The Agency for Health Care Administration reviews
-- healthcare facility construction in Florida; Illinois runs through IDPH
-- instead. The major exists in the catalog for every project (majors are global
-- by design, which is what lets Reports compare like for like), but its
-- milestones and gates are seeded for FL sites only. The 5 IL projects get the
-- major with an empty plan, which reads as "Not planned" and can be closed out
-- with the major's manual-completion action.

-- ── The six Approvals majors ──────────────────────────────────────────
-- Retire the 054 placeholders first, with the same non-destructive guard: only
-- drop a major that nothing references.
do $$
declare
  retiring text[] := array[
    'interconnection_filed', 'permit_submitted', 'permit_approved',
    'interconnection_approved', 'pto_commercial_operation'
  ];
  k text;
  in_use integer;
begin
  foreach k in array retiring loop
    select count(*) into in_use from public.workstream_milestones where major_key = k;
    if in_use > 0 then
      raise notice 'Keeping % — % milestone(s) still reference it. Move or delete them, then re-run.', k, in_use;
    else
      delete from public.workstream_majors where key = k;   -- gates cascade
    end if;
  end loop;
end $$;

insert into public.workstream_majors (key, workstream, label, sort_order) values
  ('governing_requirements', 'approvals', 'Governing Requirements and Code Review', 1),
  ('utility_approval',       'approvals', 'Utility Approval',                       2),
  ('discretionary_permits',  'approvals', 'Discretionary Permits Approved',         3),
  ('ministerial_permits',    'approvals', 'Ministerial Permits Approved',           4),
  ('ahca_approval',          'approvals', 'AHCA Approval',                          5),
  ('notice_to_proceed',      'approvals', 'Notice to Proceed',                      6)
on conflict (key) do update
  set workstream = excluded.workstream,
      label      = excluded.label,
      sort_order = excluded.sort_order;

-- ── Exit gates + key objectives ───────────────────────────────────────
insert into public.workstream_gate_templates (major_key, kind, label, sort_order) values
  -- 1. Governing Requirements and Code Review
  ('governing_requirements', 'gate',      'Permitting matrix complete',                                 1),
  ('governing_requirements', 'gate',      'AHJ scoping meeting held',                                   2),
  ('governing_requirements', 'objective', 'Complete the permitting matrix to determine required approvals', 1),
  ('governing_requirements', 'objective', 'Conduct scoping meetings with the AHJ to flag specific requirements for scope development', 2),
  ('governing_requirements', 'objective', 'Confirm the codes and standards applicable to the jurisdiction', 3),

  -- 2. Utility Approval
  ('utility_approval', 'gate',      'Interconnection application accepted',                             1),
  ('utility_approval', 'gate',      'Interconnection agreement executed',                               2),
  ('utility_approval', 'objective', 'Validate the interconnection approach based on on-site conditions', 1),
  ('utility_approval', 'objective', 'Solicit early-stage utility interconnection feedback and potential costs', 2),
  ('utility_approval', 'objective', 'Finalize interconnection requirements and upgrade costs',           3),

  -- 3. Discretionary Permits Approved
  ('discretionary_permits', 'gate',      'All discretionary approvals obtained, or confirmed not required', 1),
  ('discretionary_permits', 'objective', 'Determine whether CUP / SUP or zoning relief is required',     1),
  ('discretionary_permits', 'objective', 'Obtain any discretionary permits and approvals by the AHJ',    2),

  -- 4. Ministerial Permits Approved
  ('ministerial_permits', 'gate',      'All by-right permits issued',                                   1),
  ('ministerial_permits', 'objective', 'Confirm the AHJ''s by-right permit scope for this site',        1),
  ('ministerial_permits', 'objective', 'Submit against a frozen drawing revision',                      2),
  ('ministerial_permits', 'objective', 'Kick off AHJ pre-planning meetings prior to pre-construction',  3),

  -- 5. AHCA Approval (Florida)
  ('ahca_approval', 'gate',      'AHCA plan review approved',                                           1),
  ('ahca_approval', 'objective', 'Submit the design for healthcare facility plan review',               1),
  ('ahca_approval', 'objective', 'Respond to reviewer comments in one cycle',                           2),

  -- 6. Notice to Proceed
  ('notice_to_proceed', 'gate',      'NTP issued',                                                      1),
  ('notice_to_proceed', 'objective', 'Confirm all permits and approvals are in hand',                   1),
  ('notice_to_proceed', 'objective', 'Release the contractor to mobilize',                              2)
on conflict (major_key, kind, label) do update
  set sort_order = excluded.sort_order;

-- ── Milestone templates ───────────────────────────────────────────────
insert into public.workstream_milestone_templates (major_key, label, description, weight_pct, sort_order) values
  ('governing_requirements', 'Permitting Matrix',
   'Complete the permitting matrix to determine every approval this site requires.', 40, 1),
  ('governing_requirements', 'AHJ Scoping Meetings',
   'Conduct scoping meetings with the AHJ to flag specific requirements for scope development.', 30, 2),
  ('governing_requirements', 'Code Review Complete',
   'Confirm the codes and standards applicable to the jurisdiction and reflect them in the design basis.', 30, 3),

  ('utility_approval', 'Interconnection Approach Validated',
   'Validate the interconnection approach against on-site conditions.', 20, 1),
  ('utility_approval', 'Application Filed',
   'File the interconnection application and pay any study deposit.', 20, 2),
  ('utility_approval', 'Utility Study & Upgrade Costs',
   'Complete the utility study and finalize interconnection requirements and upgrade costs.', 30, 3),
  ('utility_approval', 'Interconnection Agreement Executed',
   'Execute the interconnection agreement.', 30, 4),

  -- Deliberately one milestone: what a site actually needs is unknown until the
  -- permitting matrix is done, and most rooftop arrays need nothing here.
  ('discretionary_permits', 'Discretionary Scope Confirmed',
   'Confirm whether any discretionary approval (CUP / SUP, zoning relief, hearing) is required for this site. Add the filings as milestones once the scope is known.', 100, 1),

  ('ministerial_permits', 'AHJ Scope Confirmed',
   'Confirm the by-right permit scope this AHJ requires — building, electrical, roofing and any local additions. Add each permit as a milestone once the scope is known.', 100, 1),

  ('ahca_approval', 'AHCA Submittal Prepared',
   'Prepare and submit the design for AHCA healthcare facility plan review.', 30, 1),
  ('ahca_approval', 'Plan Review Response',
   'Respond to AHCA reviewer comments.', 40, 2),
  ('ahca_approval', 'AHCA Approval',
   'AHCA plan review approved.', 30, 3),

  ('notice_to_proceed', 'Approvals Reconciled',
   'Reconcile every permit and approval against the permitting matrix and confirm nothing is outstanding.', 40, 1),
  ('notice_to_proceed', 'NTP Issued',
   'Issue notice to proceed and release the contractor to mobilize.', 60, 2)
on conflict (major_key, label) do update
  set description = excluded.description,
      weight_pct  = excluded.weight_pct,
      sort_order  = excluded.sort_order;

-- ── Backfill existing projects ────────────────────────────────────────
-- Gates: everything except AHCA, which is Florida-only.
insert into public.workstream_gates (project_id, major_key, kind, label, sort_order)
select p.id, t.major_key, t.kind, t.label, t.sort_order
  from public.projects p
 cross join public.workstream_gate_templates t
 where not (t.major_key = 'ahca_approval' and coalesce(p.state, '') <> 'FL')
   and not exists (
     select 1 from public.workstream_gates g
      where g.project_id = p.id and g.major_key = t.major_key
        and g.kind = t.kind and g.label = t.label
   );

-- Milestones: same AHCA exclusion. All-or-nothing per (project, major) so a
-- part-built plan is never half-seeded, which would corrupt its weights.
insert into public.workstream_milestones
  (project_id, major_key, label, description, stage_gate, weight_pct, is_critical, sort_order)
select p.id, t.major_key, t.label, t.description, t.stage_gate,
       t.weight_pct, t.is_critical, t.sort_order
  from public.projects p
 cross join public.workstream_milestone_templates t
 where not (t.major_key = 'ahca_approval' and coalesce(p.state, '') <> 'FL')
   and not exists (
     select 1 from public.workstream_milestones m
      where m.project_id = p.id and m.major_key = t.major_key
   );

-- Report what the AHCA rule did, so the Florida-only decision is visible in the
-- migration output rather than being something you have to go and verify.
do $$
declare
  fl integer;
  other integer;
begin
  select count(*) into fl    from public.projects where coalesce(state, '') = 'FL';
  select count(*) into other from public.projects where coalesce(state, '') <> 'FL';
  raise notice 'AHCA seeded for % Florida project(s); skipped for % non-Florida project(s).', fl, other;
end $$;
