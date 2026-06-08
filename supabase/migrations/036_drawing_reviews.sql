-- Drawing reviews + findings.
--   drawing_reviews     : one review per drawing (against its type's action plan)
--   review_findings     : one row per item the reviewer acts on (+ ad-hoc findings);
--                         holds the disposition, finding text, sheet ref, SOW action,
--                         and the Delegate (task) / Create-RFI tie-ins
--   set_universal_findings : the shared answers for Universal items, keyed per set
--                            (area + drawing_type). A drawing shows these unless it
--                            has a per-drawing override row in review_findings.

create table if not exists public.drawing_reviews (
  id             uuid primary key default gen_random_uuid(),
  drawing_id     uuid not null references public.drawings(id) on delete cascade,
  action_plan_id uuid not null references public.action_plans(id),
  status         text not null default 'not_started', -- not_started|in_progress|under_review|complete
  reviewer_id    uuid references public.users(id),
  qc_id          uuid references public.users(id),
  due_date       date,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  unique (drawing_id)
);

create table if not exists public.review_findings (
  id                  uuid primary key default gen_random_uuid(),
  drawing_review_id   uuid not null references public.drawing_reviews(id) on delete cascade,
  action_plan_item_id uuid references public.action_plan_items(id),  -- null for custom findings
  disposition         text,        -- confirmed | field_verify | unknown | conflict | risk | null
  finding_text        text,
  sheet_ref           text,
  sow_action          text,
  is_override         boolean not null default false,  -- true when overriding a synced Universal answer
  delegated_task_id   uuid references public.tasks(id) on delete set null,
  rfi_id              uuid references public.rfis(id) on delete set null,
  created_by          uuid references public.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.set_universal_findings (
  id                  uuid primary key default gen_random_uuid(),
  area_id             uuid not null references public.buildings(id) on delete cascade,
  drawing_type        text not null,
  action_plan_item_id uuid not null references public.action_plan_items(id),
  disposition         text,
  finding_text        text,
  sheet_ref           text,
  sow_action          text,
  updated_by          uuid references public.users(id),
  updated_at          timestamptz not null default now(),
  unique (area_id, drawing_type, action_plan_item_id)
);

create index if not exists drawing_reviews_drawing_idx on public.drawing_reviews(drawing_id);
create index if not exists review_findings_review_idx   on public.review_findings(drawing_review_id);
create index if not exists review_findings_item_idx     on public.review_findings(action_plan_item_id);
create index if not exists review_findings_disp_idx     on public.review_findings(disposition);
create index if not exists set_universal_idx            on public.set_universal_findings(area_id, drawing_type);

alter table public.drawing_reviews        enable row level security;
alter table public.review_findings        enable row level security;
alter table public.set_universal_findings enable row level security;

drop policy if exists drawing_reviews_select on public.drawing_reviews;
drop policy if exists drawing_reviews_write  on public.drawing_reviews;
drop policy if exists review_findings_select on public.review_findings;
drop policy if exists review_findings_write  on public.review_findings;
drop policy if exists set_universal_rw       on public.set_universal_findings;

create policy drawing_reviews_select on public.drawing_reviews for select to authenticated using (true);
create policy drawing_reviews_write  on public.drawing_reviews for all to authenticated using (true) with check (true);
create policy review_findings_select on public.review_findings for select to authenticated using (true);
create policy review_findings_write  on public.review_findings for all to authenticated using (true) with check (true);
create policy set_universal_rw       on public.set_universal_findings for all to authenticated using (true) with check (true);

comment on table public.drawing_reviews is 'One review per drawing, against its type''s action plan.';
comment on table public.set_universal_findings is 'Shared Universal-question answers per set (area + drawing_type); siblings inherit unless overridden in review_findings.';
