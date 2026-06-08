-- Drawing collections: user-creatable, named groupings of drawings (formerly
-- hard-coded "drawing types"). Each collection has an owner and an optional
-- action plan (the review checklist). 'As-Builts' is seeded as the first
-- collection, linked to the As-Built action plan. New collections can be added
-- from the UI (their checklist/action plan can be attached later).

create table if not exists public.drawing_collections (
  id             uuid primary key default gen_random_uuid(),
  key            text unique,                  -- stable slug ('as_built'); nullable for ad-hoc collections
  name           text not null,                -- display name, editable
  owner_id       uuid references public.users(id),
  action_plan_id uuid references public.action_plans(id),  -- the review checklist (nullable until defined)
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now()
);

alter table public.drawing_collections enable row level security;

drop policy if exists drawing_collections_select on public.drawing_collections;
drop policy if exists drawing_collections_write  on public.drawing_collections;
create policy drawing_collections_select on public.drawing_collections for select to authenticated using (true);
create policy drawing_collections_write  on public.drawing_collections for all to authenticated using (true) with check (true);

-- Seed the As-Builts collection, linked to the seeded As-Built action plan.
insert into public.drawing_collections (key, name, action_plan_id, sort_order)
select 'as_built', 'As-Builts', p.id, 0
from public.action_plans p
where p.drawing_type = 'as_built' and p.version = 1
on conflict (key) do nothing;

-- Drawings now belong to a collection.
alter table public.drawings
  add column if not exists collection_id uuid references public.drawing_collections(id);

create index if not exists drawings_collection_idx on public.drawings(collection_id);

-- Backfill existing drawings into the As-Builts collection.
update public.drawings d
set collection_id = c.id
from public.drawing_collections c
where c.key = 'as_built' and d.collection_id is null;

comment on table public.drawing_collections is 'User-creatable named groupings of drawings (drawing types). Each has an owner and an optional action plan (review checklist).';
