-- RFI links: polymorphic relationships from an RFI to project records
-- (area/building, meter, system, permit, stakeholder, drawing, or the project).
-- Mirrors task_links; lets an RFI show all related entities on its detail page.

create table if not exists public.rfi_links (
  id          uuid primary key default gen_random_uuid(),
  rfi_id      uuid not null references public.rfis(id) on delete cascade,
  entity_type text not null check (entity_type in ('project','building','meter','system','permit','stakeholder','drawing')),
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.users(id) on delete set null,
  unique (rfi_id, entity_type, entity_id)
);

create index if not exists rfi_links_rfi_idx    on public.rfi_links(rfi_id);
create index if not exists rfi_links_entity_idx on public.rfi_links(entity_type, entity_id);

alter table public.rfi_links enable row level security;

drop policy if exists rfi_links_rw on public.rfi_links;
create policy rfi_links_rw on public.rfi_links
  for all to authenticated using (true) with check (true);

comment on table public.rfi_links is 'Polymorphic links from an RFI to a project, area/building, meter, system, permit, stakeholder, or drawing.';
