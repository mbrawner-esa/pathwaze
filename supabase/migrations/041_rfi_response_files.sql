-- Files attached to an RFI response. Files live in the 'rfi-files' Storage bucket.

create table if not exists public.rfi_response_files (
  id           uuid primary key default gen_random_uuid(),
  response_id  uuid not null references public.rfi_responses(id) on delete cascade,
  rfi_id       uuid not null references public.rfis(id) on delete cascade,
  file_name    text not null,
  storage_path text,
  file_size    bigint,
  content_type text,
  uploaded_by  uuid references public.users(id),
  uploaded_at  timestamptz not null default now()
);

create index if not exists rfi_response_files_response_idx on public.rfi_response_files(response_id);
create index if not exists rfi_response_files_rfi_idx      on public.rfi_response_files(rfi_id);

alter table public.rfi_response_files enable row level security;
drop policy if exists rfi_response_files_rw on public.rfi_response_files;
create policy rfi_response_files_rw on public.rfi_response_files
  for all to authenticated using (true) with check (true);

-- ── Storage bucket for RFI response attachments ──────────────────────
insert into storage.buckets (id, name, public)
values ('rfi-files', 'rfi-files', false)
on conflict (id) do nothing;

drop policy if exists "rfi_files_select" on storage.objects;
drop policy if exists "rfi_files_insert" on storage.objects;
drop policy if exists "rfi_files_delete" on storage.objects;
create policy "rfi_files_select" on storage.objects for select to authenticated using (bucket_id = 'rfi-files');
create policy "rfi_files_insert" on storage.objects for insert to authenticated with check (bucket_id = 'rfi-files');
create policy "rfi_files_delete" on storage.objects for delete to authenticated using (bucket_id = 'rfi-files');
