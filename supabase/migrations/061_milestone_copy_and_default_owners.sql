-- Milestone copy clean-up + default major-milestone owners.
-- ⚠️ Run on Supabase, after 060. (Deploys do not touch the database.)
--
-- Part A — remove em/en dashes from milestone descriptions. Three descriptions
--   used them; each is rewritten rather than having the punctuation swapped, so
--   the sentences still read properly. Applied to the templates AND to the rows
--   already copied into each project, since the copy happened at seed time.
--
-- Part B — default owners. Ownership sits on the major milestone, so the
--   default follows the workstream:
--     Technical + Approvals → the project's assigned Project Manager
--     Commercial            → Morgan Brawner
--   Existing owners are never overwritten; only unowned majors get a default.

-- ── Part A: description copy ──────────────────────────────────────────
-- Templates first, so any project created later picks up the corrected text.
update public.workstream_milestone_templates
   set description = 'Draft the initial commercial terms (price per kWh, term and escalator) from validated savings and estimated costs.'
 where major_key = 'term_sheet' and label = 'Draft Term Sheet';

update public.workstream_milestone_templates
   set description = 'Execute the site control agreement and the energy agreement (PPA or Energy Services). The two are intertwined, so neither stands without the other.'
 where major_key = 'closing' and label = 'PPA & Site Control Execution';

update public.workstream_milestone_templates
   set description = 'Confirm the by-right permit scope this AHJ requires, including building, electrical, roofing and any local additions. Add each permit as a milestone once the scope is known.'
 where major_key = 'ministerial_permits' and label = 'AHJ Scope Confirmed';

-- Then the per-project copies. Matched on the old text so a description a PM
-- has already edited is left alone.
update public.workstream_milestones
   set description = 'Draft the initial commercial terms (price per kWh, term and escalator) from validated savings and estimated costs.'
 where major_key = 'term_sheet'
   and description like '%price per kWh, term and escalator%'
   and description ~ '[—–]';

update public.workstream_milestones
   set description = 'Execute the site control agreement and the energy agreement (PPA or Energy Services). The two are intertwined, so neither stands without the other.'
 where major_key = 'closing'
   and description like '%intertwined%'
   and description ~ '[—–]';

update public.workstream_milestones
   set description = 'Confirm the by-right permit scope this AHJ requires, including building, electrical, roofing and any local additions. Add each permit as a milestone once the scope is known.'
 where major_key = 'ministerial_permits'
   and description like '%by-right permit scope%'
   and description ~ '[—–]';

-- Catch anything missed, so this does not have to be revisited: any remaining
-- dash in a seeded description becomes a comma, which is the reading in every
-- case above.
update public.workstream_milestones
   set description = regexp_replace(description, '\s*[—–]\s*', ', ', 'g')
 where description ~ '[—–]';

update public.workstream_milestone_templates
   set description = regexp_replace(description, '\s*[—–]\s*', ', ', 'g')
 where description ~ '[—–]';

do $$
declare
  left_over integer;
begin
  select count(*) into left_over from public.workstream_milestones where description ~ '[—–]';
  raise notice 'Milestone descriptions still containing a dash: %', left_over;
end $$;

-- ── Part B: default owners ────────────────────────────────────────────
-- Technical and Approvals go to the project's Project Manager (projects.assignee_id).
-- Projects with no assignee are skipped rather than being given a wrong owner.
insert into public.workstream_major_state (project_id, major_key, owner_id)
select p.id, m.key, p.assignee_id
  from public.projects p
 cross join public.workstream_majors m
 where m.workstream in ('technical', 'approvals')
   and p.assignee_id is not null
on conflict (project_id, major_key) do update
   set owner_id = excluded.owner_id
 where public.workstream_major_state.owner_id is null;

-- Commercial goes to Morgan Brawner. Looked up by email rather than hardcoding
-- a uuid, so this stays correct if the row is ever recreated. Note there is a
-- second Morgan in the directory, which is exactly why this matches on email.
insert into public.workstream_major_state (project_id, major_key, owner_id)
select p.id, m.key, u.id
  from public.projects p
 cross join public.workstream_majors m
 cross join lateral (
   select id from public.users where email = 'mbrawner@esa-solar.com' limit 1
 ) u
 where m.workstream = 'commercial'
on conflict (project_id, major_key) do update
   set owner_id = excluded.owner_id
 where public.workstream_major_state.owner_id is null;

do $$
declare
  owned integer;
  unowned integer;
begin
  select count(*) into owned from public.workstream_major_state where owner_id is not null;
  select count(*) into unowned
    from public.projects p
   cross join public.workstream_majors m
   where not exists (
     select 1 from public.workstream_major_state s
      where s.project_id = p.id and s.major_key = m.key and s.owner_id is not null
   );
  raise notice 'Major milestones with an owner: %; still unowned: % (projects with no assigned PM).', owned, unowned;
end $$;
