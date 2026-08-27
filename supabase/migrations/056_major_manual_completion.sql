-- Manual completion of a major milestone.
-- ⚠️ Run on Supabase. (Deploys do not touch the database.)
--
-- Until now a major's status was purely derived from its milestones: complete
-- only when every milestone under it was complete. That is right most of the
-- time, but it leaves no way to close out a major that is genuinely done while
-- some milestone under it is stale, cancelled, or was never worth tracking.
--
-- This adds an explicit override. When completed_at is set, the major reads as
-- complete regardless of its milestones; clearing it hands control back to the
-- derivation. The override is deliberately stored separately from the derived
-- state so the two never get confused — nothing overwrites a milestone to make
-- a major look finished.

alter table public.workstream_major_state
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references public.users(id);

comment on column public.workstream_major_state.completed_at is
  'Manual completion override. When set, the major reads complete regardless of its milestones. Null = status is derived from the milestones underneath it.';
comment on column public.workstream_major_state.completed_by is
  'Who marked the major complete by hand. Null when the major completed by derivation.';
