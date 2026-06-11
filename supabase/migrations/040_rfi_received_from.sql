-- "Received from" can reference an internal user or a stakeholder (in addition
-- to the free-text received_from already present, kept as a fallback/legacy).

alter table public.rfis
  add column if not exists received_from_user_id uuid references public.users(id),
  add column if not exists received_from_stakeholder_id uuid references public.stakeholders(id);

create index if not exists rfis_received_user_idx on public.rfis(received_from_user_id);
create index if not exists rfis_received_sh_idx   on public.rfis(received_from_stakeholder_id);
