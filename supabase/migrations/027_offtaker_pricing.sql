-- Offtaker Pricing — versioned proposal options for customer offtake deals.
--
-- Replaces the single-row "Transaction Structure" fields on project_financials
-- with a one-to-many table so the team can track multiple proposal versions
-- per project (e.g., 20-year PPA vs 15-year ESA vs cash purchase). Each row
-- has the same contract/economics fields plus a notes field and is linked
-- to a threads table for collaborative discussion. One row per project may
-- be marked is_selected to indicate the customer's accepted proposal.

create table if not exists public.offtaker_pricing (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  version_label        text not null default 'Option A',
  is_selected          boolean not null default false,

  -- Contract terms (mirrors fields that were on project_financials)
  contract_type        text,
  revenue_type         text,
  offtaker_credit      text,
  term_months          integer,
  year1_contract_price numeric,
  escalation_rate      numeric,
  srec_treatment       text,
  avoided_cost_kwh     numeric,
  annual_savings       numeric,

  -- Free-form notes (separate from threaded discussion)
  notes                text,

  created_at           timestamptz not null default now(),
  created_by           uuid references public.users(id) on delete set null,
  updated_at           timestamptz not null default now()
);

create index if not exists offtaker_pricing_project_idx on public.offtaker_pricing(project_id);

-- Only one row per project may be marked selected.
create unique index if not exists offtaker_pricing_selected_unique
  on public.offtaker_pricing(project_id)
  where is_selected = true;

-- Threads attached to a specific pricing row (chat-style discussion).
create table if not exists public.offtaker_pricing_threads (
  id          uuid primary key default gen_random_uuid(),
  row_id      uuid not null references public.offtaker_pricing(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  user_name   text,
  user_avatar_url text,
  message     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists offtaker_pricing_threads_row_idx on public.offtaker_pricing_threads(row_id);

-- RLS — authenticated users can read/write.
alter table public.offtaker_pricing enable row level security;
alter table public.offtaker_pricing_threads enable row level security;

create policy offtaker_pricing_read on public.offtaker_pricing
  for select using (auth.role() = 'authenticated');
create policy offtaker_pricing_write on public.offtaker_pricing
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy offtaker_pricing_threads_read on public.offtaker_pricing_threads
  for select using (auth.role() = 'authenticated');
create policy offtaker_pricing_threads_write on public.offtaker_pricing_threads
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Backfill: for each project_financials row that has any transaction-structure
-- data, seed one "Option A" pricing row marked as selected. Otherwise leave
-- the project's table empty for the team to populate as they brainstorm.
insert into public.offtaker_pricing (
  project_id, version_label, is_selected,
  contract_type, revenue_type, offtaker_credit, term_months,
  year1_contract_price, escalation_rate, srec_treatment,
  avoided_cost_kwh, annual_savings
)
select
  pf.project_id, 'Option A', true,
  pf.contract_type, pf.revenue_type, pf.offtaker_credit, pf.term_months,
  pf.year1_contract_price, pf.escalation_rate, pf.srec_treatment,
  pf.avoided_cost_kwh, pf.annual_savings
from public.project_financials pf
where
  coalesce(pf.contract_type, '') <> ''
  or coalesce(pf.revenue_type, '') <> ''
  or coalesce(pf.offtaker_credit, '') <> ''
  or coalesce(pf.term_months, 0) <> 0
  or coalesce(pf.year1_contract_price, 0) <> 0
on conflict do nothing;

comment on table public.offtaker_pricing is 'Versioned offtaker proposal options. Replaces the single-row Transaction Structure on project_financials with one-to-many proposal tracking. One row per project may be marked is_selected.';
comment on table public.offtaker_pricing_threads is 'Chat-style threaded discussion attached to a specific offtaker_pricing row.';
