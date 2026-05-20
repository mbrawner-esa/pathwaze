-- Task links: polymorphic relationships between a task and other entities.
--
-- Lets users link a task to specific records on the project page —
-- buildings, meters, systems, permits, stakeholders, or the project itself —
-- and navigate to them directly from the task drawer.

create table if not exists public.task_links (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  entity_type text not null check (entity_type in ('project','building','meter','system','permit','stakeholder')),
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.users(id) on delete set null,
  unique (task_id, entity_type, entity_id)
);

create index if not exists task_links_task_idx on public.task_links(task_id);
create index if not exists task_links_entity_idx on public.task_links(entity_type, entity_id);

alter table public.task_links enable row level security;

-- RLS: anyone authenticated can read/write task links. Mirrors task RLS —
-- if a user can see a task, they should be able to see + edit its links.
create policy task_links_read on public.task_links
  for select using (auth.role() = 'authenticated');

create policy task_links_write on public.task_links
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

comment on table public.task_links is 'Polymorphic links from a task to a project, building, meter, system, permit, or stakeholder. Lets tasks reference and navigate to related project records.';
