-- ─────────────────────────────────────────────────────────────────────
-- SAMPLE DATA — one clearly-labelled test project for exercising /health.
--
-- ⚠️  READ THIS FIRST. Local dev and production share the same Supabase
--     database (see CLAUDE.md), so running this writes to the DB the team
--     uses. It is written to be safe on that basis:
--
--       · It touches ONE project, identified by project_number 'TEST-0001'.
--         No existing project is read, updated or deleted.
--       · It is idempotent — re-running wipes only this project's milestones
--         and rebuilds them, so you always get the same known state.
--       · scripts/drop-test-project.sql removes it completely.
--
--     The project is named with a leading "ZZ TEST" so it sorts last in every
--     list in the app and is unmistakable in a screen share.
--
-- Dates are RELATIVE to the day you run this (current_date ± n), so the sample
-- keeps exercising all four horizons — 1 month, 3 months, 6 months, 1 year —
-- however long from now it is run. A milestone whose baseline_date is earlier
-- than its end_date reads as slipped, which is what drives the red variance
-- and the delayed traffic light.
-- ─────────────────────────────────────────────────────────────────────

do $$
declare
  pid   uuid;
  owner uuid;
begin
  -- ── the project ───────────────────────────────────────────────────
  insert into public.projects (project_number, name, customer, stage, deal_health,
                               system_kwdc, system_kwac, address, city, state, zip, utility)
  values ('TEST-0001', 'ZZ TEST — Sample Hospital', 'AdventHealth', 'Design Development', 'At Risk',
          2400, 1900, '1 Sample Way', 'Orlando', 'FL', '32801', 'Duke Energy')
  on conflict (project_number) do update
    set name = excluded.name,
        stage = excluded.stage,
        deal_health = excluded.deal_health
  returning id into pid;

  -- A project put On Hold by a previous test would be invisible on the board,
  -- which looks like the seed failed. Clear the marker so it always comes back
  -- active.
  update public.projects set on_hold_at = null where id = pid;

  -- Owner for the major-milestone state rows. Any admin will do; the board
  -- only reads the name. Null is fine if there is no admin yet.
  select id into owner from public.users where role = 'admin' order by created_at limit 1;

  -- ── rebuild this project's milestones ─────────────────────────────
  -- Scoped to pid, so nothing outside the test project can be affected.
  delete from public.workstream_milestones where project_id = pid;

  -- Only majors that actually exist in the catalog are used: the insert joins
  -- workstream_majors, so a renamed or retired key silently contributes no row
  -- rather than failing the whole script.
  insert into public.workstream_milestones
    (project_id, major_key, label, end_date, baseline_date, status, completed_at,
     weight_pct, is_critical, sort_order)
  select pid, v.major_key, v.label,
         current_date + v.end_off,
         current_date + v.base_off,
         v.status,
         case when v.status = 'complete' then now() else null end,
         v.weight, v.critical, v.ord
  from (values
    -- ── Commercial ────────────────────────────────────────────────
    ('term_sheet',             'Term sheet issued',                -45, -45, 'complete',    50, false, 1),
    ('term_sheet',             'Term sheet countersigned',           6,   6, 'in_progress', 50, true,  2),
    ('savings_validation',     'Utility bill analysis',            -20, -20, 'complete',    40, false, 1),
    ('savings_validation',     'Savings model validated',           25,  25, 'not_started', 60, false, 2),
    ('legal_review',           'Redlines returned from counsel',    40,  40, 'not_started', 100, false, 1),
    ('closing',                'Final signature package',           75,  75, 'not_started', 100, true,  1),

    -- ── Technical ─────────────────────────────────────────────────
    ('site_feasibility',       'Site survey',                      -30, -30, 'complete',    50, false, 1),
    -- slipped 12 days and now blocked: the scenario that should sort to the top
    ('site_feasibility',       'Structural report',                  2, -10, 'blocked',     50, true,  2),
    ('design_development',     '30% design set',                    14,  14, 'in_progress', 40, false, 1),
    -- overdue AND slipped: target already passed and moved off its baseline
    ('design_development',     'Electrical room remediation scope',  -3, -17, 'blocked',    60, true,  2),
    ('late_stage_development', '60% design set',                    60,  60, 'not_started', 100, false, 1),
    ('pre_construction',       'Issued-for-construction set',      120, 120, 'not_started', 100, true,  1),
    ('construction',           'Mobilization',                     180, 180, 'not_started', 100, false, 1),

    -- ── Approvals ─────────────────────────────────────────────────
    ('governing_requirements', 'Code review complete',              10,  10, 'in_progress', 100, false, 1),
    ('utility_approval',       'Interconnection application filed', -15, -15, 'complete',   40, false, 1),
    ('utility_approval',       'System impact study results',        5,  -8, 'blocked',     60, true,  2),
    ('ahca_approval',          'AHCA submittal',                    35,  35, 'not_started', 100, false, 1),
    ('discretionary_permits',  'Zoning approval',                   90,  90, 'not_started', 100, false, 1),
    ('ministerial_permits',    'Building permit issued',           150, 150, 'not_started', 100, false, 1),
    ('notice_to_proceed',      'NTP executed',                     200, 200, 'not_started', 100, true,  1)
  ) as v(major_key, label, end_off, base_off, status, weight, critical, ord)
  join public.workstream_majors mj on mj.key = v.major_key;

  -- ── owners, so the board's Owner column is populated ──────────────
  if owner is not null then
    insert into public.workstream_major_state (project_id, major_key, owner_id)
    select pid, mj.key, owner
    from public.workstream_majors mj
    on conflict (project_id, major_key) do update set owner_id = excluded.owner_id;
  end if;

  raise notice 'Seeded % milestones on ZZ TEST — Sample Hospital (%).',
    (select count(*) from public.workstream_milestones where project_id = pid), pid;
end $$;
