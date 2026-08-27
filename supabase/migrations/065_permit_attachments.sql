-- Attachments on a permit — the application PDF, the stamped approval, the
-- correction notice. Both permit tables (Discretionary and Ministerial) are the
-- same `permits` table with different `category` values, so one table serves both.
-- ⚠️ Run on Supabase. Idempotent — safe to re-run.
--
-- Files live in the existing 'project-files' bucket (created in migration 020,
-- already authenticated-RW) under a `permits/<permit_id>/` prefix. No new
-- bucket: permits are project-scoped, and a fourth bucket would need its own
-- policy set for no gain.

create table if not exists public.permit_attachments (
  id           uuid primary key default gen_random_uuid(),
  permit_id    uuid not null references public.permits(id) on delete cascade,
  file_name    text not null,
  storage_path text,
  file_size    bigint,
  content_type text,
  -- Which document this is, so the drawer can group them. Free text rather than
  -- an enum: AHJs invent document types and a check constraint would mean a
  -- migration every time one does.
  doc_type     text,
  uploaded_by  uuid references public.users(id),
  uploaded_at  timestamptz not null default now()
);

create index if not exists permit_attachments_permit_idx
  on public.permit_attachments(permit_id);

comment on table public.permit_attachments is
  'Files attached to a permit. Stored in the project-files bucket under permits/<permit_id>/.';
comment on column public.permit_attachments.doc_type is
  'Document role — Application, Approval, Correction Notice, Inspection Report, Receipt, Other. Free text by design.';

alter table public.permit_attachments enable row level security;

-- Matches the access model on `permits` itself: any authenticated app user can
-- read and write. Project-level scoping is enforced upstream on `permits`.
drop policy if exists permit_attachments_rw on public.permit_attachments;
create policy permit_attachments_rw on public.permit_attachments
  for all to authenticated using (true) with check (true);
