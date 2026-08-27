-- Commercial workstream: renames "financial" and loads the real content.
-- ⚠️ Run on Supabase, after 057. (Deploys do not touch the database.)
--
-- Source: AH_OSS_Workstreams.pptx (approval matrix + footnotes) and the same
-- major → gates/objectives → milestones shape as the Technical outline.
--
-- The workstream is renamed financial → commercial because it covers the legal
-- track as well as the financial one: forms of agreement, site control, PPA /
-- Energy Services, and closing sit alongside savings validation and pricing.
--
-- Six majors, ordered as the work actually runs:
--   1 Term Sheet             initial commercial terms → CFO approval for LNTP
--   2 Savings Validation     validate the financial basis against real data
--   3 Legal Review           review + approval of the FORMS of agreement only
--   4 Market-Based Pricing   EPC RFP through to the initial bid
--   5 Final Commercial Terms re-cut terms against real cost → approval
--   6 Closing                binding bid, execution, due diligence, close
--
-- Two deliberate separations, both of which caused duplicate milestones in
-- earlier drafts:
--   * Term Sheet vs Final Commercial Terms — the same fields (price per kWh,
--     term, escalator, NPV, savings) priced before and after contractor pricing.
--   * Initial Bid (Market-Based Pricing) vs Final Bid (Closing) — the priced
--     response after clarifications, and the binding bid accepted months later.
--
-- Nothing is seeded as complete, dated, or critical path: those are per-project
-- judgements the team makes by hand.

-- ── Rename the workstream ─────────────────────────────────────────────
-- The check constraints were created inline in 054, so their generated names
-- reflect the ORIGINAL table names (workstream_milestones, before it was renamed
-- to workstream_majors). Find them by definition rather than guessing the name.
do $$
declare
  c record;
begin
  for c in
    select rel.relname as table_name, con.conname as constraint_name
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and con.contype = 'c'
       and rel.relname in ('workstream_majors', 'workstream_updates')
       and pg_get_constraintdef(con.oid) like '%financial%'
  loop
    execute format('alter table public.%I drop constraint %I', c.table_name, c.constraint_name);
  end loop;
end $$;

update public.workstream_majors  set workstream = 'commercial' where workstream = 'financial';
update public.workstream_updates set workstream = 'commercial' where workstream = 'financial';

alter table public.workstream_majors
  add constraint workstream_majors_workstream_check
  check (workstream in ('commercial', 'technical', 'approvals'));

alter table public.workstream_updates
  add constraint workstream_updates_workstream_check
  check (workstream in ('commercial', 'technical', 'approvals'));

-- ── Retire the placeholder Commercial majors ──────────────────────────
-- Same non-destructive guard as 057: only drop a major nothing references.
do $$
declare
  retiring text[] := array[
    'site_assessment_complete', 'ppa_executed',
    'dev_budget_approved', 'equipment_procurement'
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

-- ── The six Commercial majors ─────────────────────────────────────────
insert into public.workstream_majors (key, workstream, label, sort_order) values
  ('term_sheet',             'commercial', 'Term Sheet',             1),
  ('savings_validation',     'commercial', 'Savings Validation',     2),
  ('legal_review',           'commercial', 'Legal Review',           3),
  ('market_based_pricing',   'commercial', 'Market-Based Pricing',   4),
  ('final_commercial_terms', 'commercial', 'Final Commercial Terms', 5),
  ('closing',                'commercial', 'Closing',                6)
on conflict (key) do update
  set workstream = excluded.workstream,
      label      = excluded.label,
      sort_order = excluded.sort_order;

-- ── Stage gates + key objectives ──────────────────────────────────────
-- Corporate / regional / facility approval levels from the deck's legend are
-- carried as a prefix on the gate label, so the distinction stays visible
-- without another column.
insert into public.workstream_gate_templates (major_key, kind, label, sort_order) values
  -- 1. Term Sheet
  ('term_sheet', 'gate',      'CFO: LNTP approval of the term sheet',                              1),
  ('term_sheet', 'objective', 'Set price per kWh, term and escalator on validated savings',        1),
  ('term_sheet', 'objective', 'Confirm estimated NPV and estimated savings',                       2),
  ('term_sheet', 'objective', 'Obtain CFO approval to proceed under limited notice to proceed',    3),

  -- 2. Savings Validation
  ('savings_validation', 'gate',      'Post site survey validation delivered',                     1),
  ('savings_validation', 'objective', 'Validate avoided energy costs from interval data and accurate load profiles', 1),
  ('savings_validation', 'objective', 'Confirm savings against final meter selection',             2),
  ('savings_validation', 'objective', 'Determine pricing for property taxes, insurance and O&M',   3),

  -- 3. Legal Review — approval of the FORMS of agreement, not execution
  ('legal_review', 'gate',      'Corporate: form of agreement approved',                           1),
  ('legal_review', 'gate',      'Facility / Regional: site-level terms approved',                  2),
  ('legal_review', 'gate',      'Final forms approved with site-specific schedules',               3),
  ('legal_review', 'objective', 'Conform master forms to AdventHealth system-wide legal requirements', 1),
  ('legal_review', 'objective', 'Reflect facility-level access, notice and defined access areas in the executable version', 2),
  ('legal_review', 'objective', 'Populate site-specific schedules and financial details once contractor pricing is known', 3),

  -- 4. Market-Based Pricing
  ('market_based_pricing', 'gate',      'Shortlist approved',                                      1),
  ('market_based_pricing', 'gate',      'Initial bid received',                                    2),
  ('market_based_pricing', 'objective', 'Solicit the EPC RFP and establish market-based pricing',  1),
  ('market_based_pricing', 'objective', 'Resolve bid clarifications and scope gaps',               2),
  ('market_based_pricing', 'objective', 'Confirm ITC compliance requirements are carried in EPC scope', 3),

  -- 5. Final Commercial Terms
  ('final_commercial_terms', 'gate',      'Final commercial terms reviewed and approved',          1),
  ('final_commercial_terms', 'objective', 'Re-cut price per kWh, term and escalator against real cost', 1),
  ('final_commercial_terms', 'objective', 'Confirm final NPV and savings hold against the term sheet', 2),

  -- 6. Closing
  ('closing', 'gate',      'Contractor selected per market / tranche',                             1),
  ('closing', 'gate',      'Site control and energy agreements executed',                          2),
  ('closing', 'gate',      'Financial close / NTP',                                                3),
  ('closing', 'objective', 'Award the binding bid and select the contractor',                      1),
  ('closing', 'objective', 'Execute site control and energy agreements ahead of the portfolio outside date', 2),
  ('closing', 'objective', 'Complete closing due diligence for financial close',                   3)
on conflict (major_key, kind, label) do update
  set sort_order = excluded.sort_order;

-- ── Milestone templates ───────────────────────────────────────────────
insert into public.workstream_milestone_templates (major_key, label, description, weight_pct, sort_order) values
  -- 1. Term Sheet
  ('term_sheet', 'Draft Term Sheet',
   'Draft the initial commercial terms — price per kWh, term and escalator — from validated savings and estimated costs.', 30, 1),
  ('term_sheet', 'Term Sheet Issued',
   'Issue the term sheet to AdventHealth for review, including estimated NPV and estimated savings.', 30, 2),
  ('term_sheet', 'LNTP CFO Approval',
   'CFO approval of the initial term sheet, releasing limited notice to proceed.', 40, 3),

  -- 2. Savings Validation
  ('savings_validation', 'Interval Data & Load Profile Review',
   'Obtain interval data and build an accurate load profile for the facility.', 30, 1),
  ('savings_validation', 'Avoided-Cost & Rate Analysis',
   'Validate estimated avoided energy costs against the facility tariff and load profile.', 30, 2),
  ('savings_validation', 'Opex Pricing',
   'Determine pricing for property taxes, insurance and O&M.', 20, 3),
  ('savings_validation', 'Post-Site-Survey Savings Validation',
   'Site surveys complete, interval data received, and savings validated against final meter selection.', 20, 4),

  -- 3. Legal Review
  ('legal_review', 'Corporate Legal Review',
   'ESA issues the blank-form site control agreement and the master energy agreement forms (PPA for Illinois, Energy Services Agreement for Florida). AdventHealth corporate reviews and approves the terms and conditions governing the master agreement with the portfolio hold-co.', 40, 1),
  ('legal_review', 'Site Legal Review',
   'Conform the master forms to facility level: access requirements, notice, and defined access areas specific to final design. Solicit site-level leadership requirements and obtain regional approval.', 30, 2),
  ('legal_review', 'Final Legal Review',
   'Once contractor pricing is known, populate the final form agreements with site-specific schedules and financial details and close final redlines. Execution itself happens at Closing.', 30, 3),

  -- 4. Market-Based Pricing
  ('market_based_pricing', 'RFP Issued',
   'Issue the EPC RFP to the contractor shortlist for the market or tranche.', 30, 1),
  ('market_based_pricing', 'Pricing Review & Clarifications',
   'Review bid pricing, resolve RFIs and scope clarifications, and coordinate on-site construction walks as needed.', 40, 2),
  ('market_based_pricing', 'Initial Bid',
   'Priced bid response following clarifications. Establishes the market-based cost basis for final commercial terms.', 30, 3),

  -- 5. Final Commercial Terms
  ('final_commercial_terms', 'Final Cost Basis',
   'Fold the initial bid and site costs into the pricing model to establish the final cost basis.', 30, 1),
  ('final_commercial_terms', 'Final Pricing & Terms',
   'Final PPA / Energy Services commercial terms: price per kWh, term, escalator, estimated NPV, and estimated savings.', 40, 2),
  ('final_commercial_terms', 'Review and Approval',
   'AdventHealth review and approval of the final commercial terms.', 30, 3),

  -- 6. Closing
  ('closing', 'Final Bid',
   'Binding bid accepted from the selected contractor.', 20, 1),
  ('closing', 'Contractor Selected',
   'Award the contractor per market / tranche and confirm ITC compliance requirements in scope.', 15, 2),
  ('closing', 'PPA & Site Control Execution',
   'Execute the site control agreement and the energy agreement (PPA or Energy Services). The two are intertwined — neither stands without the other.', 25, 3),
  ('closing', 'Closing Due Diligence',
   'Conduct closing due diligence for financial close.', 25, 4),
  ('closing', 'Financial Close / NTP',
   'Reach financial close and issue notice to proceed.', 15, 5)
on conflict (major_key, label) do update
  set description = excluded.description,
      weight_pct  = excluded.weight_pct,
      sort_order  = excluded.sort_order;

-- ── Backfill existing projects ────────────────────────────────────────
insert into public.workstream_gates (project_id, major_key, kind, label, sort_order)
select p.id, t.major_key, t.kind, t.label, t.sort_order
  from public.projects p
 cross join public.workstream_gate_templates t
 where not exists (
   select 1 from public.workstream_gates g
    where g.project_id = p.id and g.major_key = t.major_key
      and g.kind = t.kind and g.label = t.label
 );

-- All-or-nothing per (project, major): half-seeding a partly-built plan would
-- corrupt its weights.
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
