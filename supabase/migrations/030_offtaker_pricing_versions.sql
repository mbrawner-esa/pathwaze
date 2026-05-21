-- Track explicit version history per offtaker_pricing row. Each row is one
-- proposal "Option" for the customer (Option A, Option B, etc); the version
-- column counts edits to THAT option so the team can reconstruct how a
-- proposal evolved over time.
--
-- Field-by-field change details are logged separately in activity_log
-- (entity_type='offtaker_pricing', entity_id=row.id, metadata.project_id),
-- so the existing project activity feed surfaces them automatically.

alter table public.offtaker_pricing
  add column if not exists version integer not null default 1;

comment on column public.offtaker_pricing.version is
  'Edit count for this proposal option. Starts at 1, increments on every PATCH. Lets the team see "this is v3 of Option A". The actual change log lives in activity_log.';
