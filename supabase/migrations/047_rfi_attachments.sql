-- Attachments on the RFI itself (not tied to a response). Files live in the
-- existing 'rfi-files' Storage bucket (created in migration 041), stored under
-- the RFI id prefix just like response files.
-- ⚠️ Run on Supabase.

create table if not exists public.rfi_attachments (
  id           uuid primary key default gen_random_uuid(),
  rfi_id       uuid not null references public.rfis(id) on delete cascade,
  file_name    text not null,
  storage_path text,
  file_size    bigint,
  content_type text,
  uploaded_by  uuid references public.users(id),
  uploaded_at  timestamptz not null default now()
);

create index if not exists rfi_attachments_rfi_idx on public.rfi_attachments(rfi_id);

alter table public.rfi_attachments enable row level security;
drop policy if exists rfi_attachments_rw on public.rfi_attachments;
create policy rfi_attachments_rw on public.rfi_attachments
  for all to authenticated using (true) with check (true);

comment on table public.rfi_attachments is 'Files attached directly to an RFI (not to a response). Stored in the rfi-files bucket.';
