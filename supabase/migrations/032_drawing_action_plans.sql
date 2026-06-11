-- Drawing action plans: reusable review-checklist templates, keyed to a drawing
-- type. For v1 there is one plan, 'as_built'. A plan has sections (disciplines,
-- including the special 'Universal' section) and each section has items (the
-- questions a reviewer works through).
--
-- Seed data lives in 033_seed_asbuilt_action_plan.sql.

create table if not exists public.action_plans (
  id           uuid primary key default gen_random_uuid(),
  drawing_type text not null,                 -- 'as_built' (future: 'pv_design', 'permit_set')
  name         text not null,                 -- 'As-Built Review'
  version      int  not null default 1,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (drawing_type, version)
);

create table if not exists public.action_plan_sections (
  id                  uuid primary key default gen_random_uuid(),
  action_plan_id      uuid not null references public.action_plans(id) on delete cascade,
  key                 text not null,          -- 'universal','electrical','structural',...
  label               text not null,          -- 'Electrical'
  is_universal        boolean not null default false,  -- true => answers sync across the set
  sort_order          int  not null default 0,
  suggested_categories text[],                -- optional: building categories that typically use this discipline
  unique (action_plan_id, key)
);

create table if not exists public.action_plan_items (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.action_plan_sections(id) on delete cascade,
  sort_order    int  not null default 0,
  prompt        text not null,                -- the question
  hunting_for   text,                         -- "what you're hunting for" (Universal questions carry this)
  reviewer_hint text,                         -- null | 'pm_engineer' | 'engineer' (drives the engineer-follow-up marker)
  unique (section_id, sort_order)
);

create index if not exists action_plan_sections_plan_idx on public.action_plan_sections(action_plan_id);
create index if not exists action_plan_items_section_idx  on public.action_plan_items(section_id);

-- RLS: reference data — any authenticated user can read. No write policy
-- (plans are seeded via migration; an admin editor can add policies later).
alter table public.action_plans          enable row level security;
alter table public.action_plan_sections  enable row level security;
alter table public.action_plan_items     enable row level security;

drop policy if exists action_plans_read         on public.action_plans;
drop policy if exists action_plan_sections_read on public.action_plan_sections;
drop policy if exists action_plan_items_read    on public.action_plan_items;

create policy action_plans_read         on public.action_plans         for select to authenticated using (true);
create policy action_plan_sections_read on public.action_plan_sections for select to authenticated using (true);
create policy action_plan_items_read    on public.action_plan_items    for select to authenticated using (true);

comment on table public.action_plans is 'Review-checklist templates keyed to a drawing type (as_built, future pv_design). Seeded; editable via admin UI later.';
