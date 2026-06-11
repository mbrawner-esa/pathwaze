-- drawing_disciplines: join table letting one drawing carry MANY disciplines.
-- Previously drawings.discipline_key was a single text column (one discipline per
-- drawing). We keep that column populated with the *primary* (first) discipline
-- for backward compat (it is now DEPRECATED — do not rely on it for review scope),
-- but this join table is the source of truth for the full set of disciplines.
--
-- A drawing's review scope = the action plan's Universal section + EVERY discipline
-- section whose key appears here (merged, de-duplicated).

create table if not exists public.drawing_disciplines (
  drawing_id     uuid not null references public.drawings(id) on delete cascade,
  discipline_key text not null,
  created_at     timestamptz not null default now(),
  primary key (drawing_id, discipline_key)
);

create index if not exists drawing_disciplines_drawing_idx on public.drawing_disciplines(drawing_id);

-- Backfill: every existing drawing with a non-null discipline_key gets a join row.
insert into public.drawing_disciplines (drawing_id, discipline_key)
select id, discipline_key from public.drawings
where discipline_key is not null and discipline_key <> ''
on conflict do nothing;

alter table public.drawing_disciplines enable row level security;

drop policy if exists drawing_disciplines_select on public.drawing_disciplines;
drop policy if exists drawing_disciplines_write  on public.drawing_disciplines;

-- Match the current era's convention (drawings/RFIs/system_buildings): read for any
-- authenticated user; writes for any authenticated user (app-layer permissions gate intent).
create policy drawing_disciplines_select on public.drawing_disciplines for select to authenticated using (true);
create policy drawing_disciplines_write  on public.drawing_disciplines for all    to authenticated using (true) with check (true);

comment on table public.drawing_disciplines is 'Many-to-many link of drawings to discipline keys (action_plan_sections.key). drawings.discipline_key holds the primary discipline for back-compat (DEPRECATED); this table holds the full set used for review scope.';
