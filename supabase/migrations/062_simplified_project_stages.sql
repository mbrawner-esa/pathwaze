-- Project stage taxonomy, aligned to the full project lifecycle.
-- ⚠️ Run on Supabase, after 061. (Deploys do not touch the database.)
--
-- Workstreams carries the detail of where a project is; stage answers the coarse
-- question of which lifecycle phase it sits in, plus whether it is alive at all.
--
--   Pre-Planning  ┐
--   Design Development │
--   Pre-NTP            │
--   Closing            │  the nine pipeline phases, in order
--   NTP                │
--   Pre-Construction   │
--   Construction       │
--   Post Construction  │
--   Operation     ┘
--
--   On Hold    alive, but not in the current active work queue
--   Archived   deal is dead (a lost opportunity, in CRM terms)
--
-- Archiving is unchanged: it still rides on stage = 'Archived', and every
-- "hide archived" query keeps working as-is.
--
-- Most legacy values survive the rename, so this mostly tidies the three that
-- were renamed and the one ('Prospecting') that the create API kept writing
-- despite being removed back in migration 018.

update public.projects set stage = 'Design Development' where stage = 'Bidding';
update public.projects set stage = 'Pre-NTP'            where stage = 'Late Stage Development';
update public.projects set stage = 'Closing'            where stage = 'Pre-Closing';
update public.projects set stage = 'Construction'       where stage = 'Active Construction';
update public.projects set stage = 'Operation'          where stage = 'Operating';

-- Closeout is the tail of construction rather than a phase of its own.
update public.projects set stage = 'Post Construction'  where stage = 'Closeout';

-- 'Prospecting' predates migration 018 but was still the default in the
-- project-create API, the New Project form and the duplicate route until now,
-- so any project created since then carries it and renders as a blank badge.
update public.projects set stage = 'Pre-Planning' where stage = 'Prospecting';

-- Anything else unrecognised becomes Pre-Planning rather than rendering blank.
update public.projects
   set stage = 'Pre-Planning'
 where stage is null
    or stage not in (
      'Pre-Planning', 'Design Development', 'Pre-NTP', 'Closing', 'NTP',
      'Pre-Construction', 'Construction', 'Post Construction', 'Operation',
      'On Hold', 'Archived'
    );

comment on column public.projects.stage is
  'Lifecycle phase: Pre-Planning | Design Development | Pre-NTP | Closing | NTP | Pre-Construction | Construction | Post Construction | Operation, plus On Hold (paused) and Archived (dead). Detailed progress lives in Workstreams. Archiving still uses stage = ''Archived''.';

do $$
declare
  r record;
begin
  for r in select stage, count(*) as n from public.projects group by stage order by 2 desc loop
    raise notice 'stage %: % project(s)', r.stage, r.n;
  end loop;
end $$;
