-- System design revisions + Site Plans.
-- ⚠️ Run on Supabase. (Deploys do not touch the database.)
--
-- Part A — systems.design_rev: an auto-incrementing revision that doubles as a
--   "design last modified" marker. Replaces the hand-typed design_version label,
--   which was never maintained (every row still held the 'v1.0' default).
--   design_version is KEPT as a legacy/import label; no new UI reads it.
--
-- Part B — Site Plans: modeled as a drawing_collections row (key 'site_plan') so
--   upload/linkage live in the existing Drawings tab. Site plans link to SYSTEMS
--   rather than area+discipline, so collections gain a link_target discriminator
--   and drawings gain a drawing_systems join table. The collection has no action
--   plan — site plans are records, not review targets.

-- ── Part A: system design revisions ──────────────────────────────────
alter table public.systems
  add column if not exists design_rev    integer not null default 1,
  add column if not exists design_rev_at timestamptz,
  add column if not exists design_rev_by uuid references public.users(id);

-- Seed the revision timestamp from the row's last update so the UI has a date
-- to show for pre-existing systems (rev stays at 1 — no history to infer).
update public.systems
  set design_rev_at = coalesce(updated_at, created_at)
  where design_rev_at is null;

comment on column public.systems.design_rev is
  'Auto-incrementing design revision. Bumped by the API only when a design-defining field changes (sizes, yield, system_type, module/inverter counts + ratings, design_url, linked areas, or a newly linked site plan). Never bumped by name/design_status/meter_id edits.';
comment on column public.systems.design_version is
  'DEPRECATED legacy/imported version label. Superseded by design_rev; retained for historical values.';

-- ── Part B: collections learn what their drawings link to ────────────
alter table public.drawing_collections
  add column if not exists link_target text not null default 'area_discipline';
  -- 'area_discipline' = the review flow (area + discipline → checklist)
  -- 'system'          = site-plan style (links to one or more systems, no review)

comment on column public.drawing_collections.link_target is
  'What drawings in this collection link to: ''area_discipline'' (review flow) or ''system'' (site plans).';

-- Seed the Site Plans collection. No action_plan_id: site plans are records, not
-- reviewed drawings. sort_order 1 puts it just after As-Builts.
insert into public.drawing_collections (key, name, action_plan_id, link_target, sort_order)
values ('site_plan', 'Site Plans', null, 'system', 1)
on conflict (key) do nothing;

-- Idempotent re-run guard: if the site_plan collection already exists (created by
-- hand or by an earlier partial run), make sure it is flagged as system-linked.
-- Existing collections keep 'area_discipline' via the column default above.
update public.drawing_collections
  set link_target = 'system'
  where key = 'site_plan' and link_target <> 'system';

-- ── Part B: drawing → systems many-to-many ───────────────────────────
create table if not exists public.drawing_systems (
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  system_id  uuid not null references public.systems(id)  on delete cascade,
  primary key (drawing_id, system_id)
);

create index if not exists drawing_systems_drawing_idx on public.drawing_systems(drawing_id);
create index if not exists drawing_systems_system_idx  on public.drawing_systems(system_id);

alter table public.drawing_systems enable row level security;

drop policy if exists drawing_systems_select on public.drawing_systems;
drop policy if exists drawing_systems_write  on public.drawing_systems;
create policy drawing_systems_select on public.drawing_systems for select to authenticated using (true);
create policy drawing_systems_write  on public.drawing_systems for all    to authenticated using (true) with check (true);

comment on table public.drawing_systems is
  'Many-to-many link of drawings to systems. Used by the Site Plans collection: one site plan PDF can cover several systems. The current site plan for a system is the linked drawing with the latest uploaded_at.';
