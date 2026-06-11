-- Drawings: uploaded engineered drawings, linked to a project and (once linked)
-- to an area (a buildings row) + a single discipline. Each drawing is reviewed
-- against its type's action plan. Files live in the 'drawings' Storage bucket.

create table if not exists public.drawings (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  area_id        uuid references public.buildings(id) on delete set null,  -- null until linked
  drawing_type   text not null default 'as_built',
  discipline_key text,                          -- null until tagged; matches action_plan_sections.key
  file_name      text not null,
  file_url       text,                          -- external link (optional)
  storage_path   text,                          -- Supabase Storage 'drawings' bucket object path
  file_size      bigint,
  content_type   text,
  set_label      text,                          -- e.g. 'IFC 2014 rev.3'
  uploaded_by    uuid references public.users(id),
  uploaded_at    timestamptz not null default now()
);

create index if not exists drawings_project_idx    on public.drawings(project_id);
create index if not exists drawings_area_idx        on public.drawings(area_id);
create index if not exists drawings_type_idx        on public.drawings(project_id, drawing_type);

alter table public.drawings enable row level security;

drop policy if exists drawings_select on public.drawings;
drop policy if exists drawings_write  on public.drawings;

-- Read: any authenticated user (investor portal uses a separate token flow).
create policy drawings_select on public.drawings for select to authenticated using (true);
-- Write: any authenticated user for now; tighten to non-investor roles in app + here later.
create policy drawings_write  on public.drawings for all to authenticated using (true) with check (true);

-- ── Storage bucket for drawing file uploads ──────────────────────────
insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', false)
on conflict (id) do nothing;

drop policy if exists "drawings_obj_select" on storage.objects;
drop policy if exists "drawings_obj_insert" on storage.objects;
drop policy if exists "drawings_obj_delete" on storage.objects;

create policy "drawings_obj_select" on storage.objects for select to authenticated using (bucket_id = 'drawings');
create policy "drawings_obj_insert" on storage.objects for insert to authenticated with check (bucket_id = 'drawings');
create policy "drawings_obj_delete" on storage.objects for delete to authenticated using (bucket_id = 'drawings');

comment on table public.drawings is 'Uploaded drawings, linked to a project + area + discipline. Each is reviewed against its drawing type''s action plan.';
