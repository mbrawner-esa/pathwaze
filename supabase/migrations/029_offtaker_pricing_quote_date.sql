-- Adds quote_created_at to offtaker_pricing so the team can track when a
-- customer-facing quote was prepared (separate from the internal row
-- created_at timestamp).

alter table public.offtaker_pricing
  add column if not exists quote_created_at date;

comment on column public.offtaker_pricing.quote_created_at is
  'The date the customer-facing quote/proposal was prepared. Distinct from the row created_at audit timestamp.';
