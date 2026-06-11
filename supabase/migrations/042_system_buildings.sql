-- system_buildings: join table letting one system link to MANY areas (buildings).
-- Previously systems.building_id was a single FK (one area per system). We keep
-- that column populated with the *primary* (first) area for backward compat, but
-- this join table is the source of truth for the full set of linked areas.

create table if not exists public.system_buildings (
  system_id   uuid not null references public.systems(id)   on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (system_id, building_id)
);

create index if not exists system_buildings_system_idx   on public.system_buildings(system_id);
create index if not exists system_buildings_building_idx on public.system_buildings(building_id);

-- Backfill: every existing system with a building_id gets a join row.
insert into public.system_buildings (system_id, building_id)
select id, building_id from public.systems
where building_id is not null
on conflict do nothing;

alter table public.system_buildings enable row level security;

drop policy if exists system_buildings_select on public.system_buildings;
drop policy if exists system_buildings_write  on public.system_buildings;

-- Match the current era's convention (drawings/RFIs): read for any authenticated
-- user; writes for any authenticated user (app-layer permissions gate intent).
create policy system_buildings_select on public.system_buildings for select to authenticated using (true);
create policy system_buildings_write  on public.system_buildings for all    to authenticated using (true) with check (true);

comment on table public.system_buildings is 'Many-to-many link of systems to areas (buildings). systems.building_id holds the primary area for back-compat; this table holds the full set.';
