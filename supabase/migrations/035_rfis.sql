-- RFIs: Procore-style Requests for Information. Portfolio-wide module (master
-- nav), each RFI scoped to a project and numbered per project. Can be created
-- standalone or from a drawing-review finding. Ball-in-court is either an
-- internal user or an external stakeholder (EOR / AHJ / Owner).

create table if not exists public.rfis (
  id                            uuid primary key default gen_random_uuid(),
  project_id                    uuid not null references public.projects(id) on delete cascade,
  rfi_number                    int  not null,                 -- sequential per project
  subject                       text not null,
  question                      text,
  status                        text not null default 'draft', -- draft | open | closed
  priority                      text not null default 'normal',-- low | normal | high
  -- ball in court (one of):
  ball_in_court_user_id         uuid references public.users(id),
  ball_in_court_stakeholder_id  uuid references public.stakeholders(id),
  rfi_manager_id                uuid references public.users(id),
  received_from                 text,
  due_date                      date,
  date_initiated                date,
  closed_at                     timestamptz,
  -- references / impact
  drawing_number                text,
  spec_section                  text,
  location                      text,
  cost_impact                   text default 'tbd',            -- yes | no | tbd
  cost_amount                   numeric,
  schedule_impact               text default 'tbd',
  schedule_days                 int,
  is_private                    boolean not null default false,
  -- tie-ins back into Pathwaze
  area_id                       uuid references public.buildings(id) on delete set null,
  drawing_id                    uuid references public.drawings(id) on delete set null,
  -- official response set after rfi_responses exists (FK added below)
  official_response_id          uuid,
  created_by                    uuid references public.users(id),
  created_at                    timestamptz not null default now(),
  unique (project_id, rfi_number)
);

create table if not exists public.rfi_responses (
  id           uuid primary key default gen_random_uuid(),
  rfi_id       uuid not null references public.rfis(id) on delete cascade,
  author_id    uuid references public.users(id),   -- null for external responders
  author_name  text,
  author_email text,
  body         text not null,
  is_official  boolean not null default false,
  via          text not null default 'app',        -- app | email
  created_at   timestamptz not null default now()
);

create table if not exists public.rfi_distribution (
  id             uuid primary key default gen_random_uuid(),
  rfi_id         uuid not null references public.rfis(id) on delete cascade,
  user_id        uuid references public.users(id),
  stakeholder_id uuid references public.stakeholders(id),
  contact_email  text
);

-- official_response_id -> rfi_responses (added after both tables exist)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'rfis_official_response_fk' and table_name = 'rfis'
  ) then
    alter table public.rfis
      add constraint rfis_official_response_fk
      foreign key (official_response_id) references public.rfi_responses(id) on delete set null;
  end if;
end $$;

create index if not exists rfis_project_idx        on public.rfis(project_id);
create index if not exists rfis_status_idx         on public.rfis(status);
create index if not exists rfis_ball_user_idx      on public.rfis(ball_in_court_user_id);
create index if not exists rfi_responses_rfi_idx   on public.rfi_responses(rfi_id);
create index if not exists rfi_distribution_rfi_idx on public.rfi_distribution(rfi_id);

alter table public.rfis             enable row level security;
alter table public.rfi_responses    enable row level security;
alter table public.rfi_distribution enable row level security;

drop policy if exists rfis_select on public.rfis;
drop policy if exists rfis_write  on public.rfis;
drop policy if exists rfi_responses_select on public.rfi_responses;
drop policy if exists rfi_responses_write  on public.rfi_responses;
drop policy if exists rfi_distribution_rw  on public.rfi_distribution;

create policy rfis_select on public.rfis for select to authenticated using (true);
create policy rfis_write  on public.rfis for all to authenticated using (true) with check (true);
create policy rfi_responses_select on public.rfi_responses for select to authenticated using (true);
create policy rfi_responses_write  on public.rfi_responses for all to authenticated using (true) with check (true);
create policy rfi_distribution_rw  on public.rfi_distribution for all to authenticated using (true) with check (true);

-- Per-project next RFI number, allocated inside a transaction to avoid races.
create or replace function public.next_rfi_number(p_project uuid)
returns int
language sql
as $$
  select coalesce(max(rfi_number), 0) + 1 from public.rfis where project_id = p_project;
$$;

comment on table public.rfis is 'Procore-style RFIs. Per-project numbering; ball-in-court is an internal user or external stakeholder; optionally created from a drawing-review finding.';
