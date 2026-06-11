-- The "set" that Universal answers sync across is an area + collection (not a
-- raw drawing_type). Add collection_id and key the shared answers by
-- (area_id, collection_id, action_plan_item_id).

alter table public.set_universal_findings
  add column if not exists collection_id uuid references public.drawing_collections(id) on delete cascade;

-- drawing_type is no longer required (collection_id supersedes it).
alter table public.set_universal_findings alter column drawing_type drop not null;

create unique index if not exists set_universal_collection_uq
  on public.set_universal_findings(area_id, collection_id, action_plan_item_id);

create index if not exists set_universal_collection_idx
  on public.set_universal_findings(area_id, collection_id);
