-- Offtaker Pricing v2 — restructure for v2 design.
--
-- Adds:
--   linked_system_ids       — uuid[] of systems this proposal covers
--   meter_savings           — jsonb map of meter_id → electric bill savings $
--   estimated_ntp           — per-proposal NTP date (pre-populated from project.start_date)
--   estimated_cod           — per-proposal COD date (pre-populated from project.target_cod)
--   utility_escalation_rate — % escalation on utility costs (default 5)
--   customer_term_savings   — user-entered $ value
--   customer_term_npv       — user-entered $ value
--
-- Drops (moved or replaced):
--   contract_type           → moves to Tax & Incentives section (lives on project_financials)
--   offtaker_credit         → moves to Tax & Incentives section (lives on project_financials)
--   avoided_cost_kwh        → replaced by per-meter calc derived from meter_savings
--   annual_savings          → replaced by Total Electric Bill Savings (sum of meter_savings values)
--
-- Kept:
--   srec_treatment, revenue_type, term_months, year1_contract_price,
--   escalation_rate, notes, version_label, is_selected

alter table public.offtaker_pricing
  add column if not exists linked_system_ids uuid[] not null default '{}'::uuid[],
  add column if not exists meter_savings jsonb not null default '{}'::jsonb,
  add column if not exists estimated_ntp date,
  add column if not exists estimated_cod date,
  add column if not exists utility_escalation_rate numeric default 5,
  add column if not exists customer_term_savings numeric,
  add column if not exists customer_term_npv numeric;

alter table public.offtaker_pricing
  drop column if exists contract_type,
  drop column if exists offtaker_credit,
  drop column if exists avoided_cost_kwh,
  drop column if exists annual_savings;

comment on column public.offtaker_pricing.linked_system_ids is 'Array of system ids this proposal covers. Drives sums for system size DC + Year 1 energy production, and determines which meters appear in Utility Savings.';
comment on column public.offtaker_pricing.meter_savings is 'JSON map of meter_id → user-entered electric bill savings ($). Used to compute per-meter avoided cost and Total Electric Bill Savings.';
comment on column public.offtaker_pricing.utility_escalation_rate is 'Annual electric utility escalation rate, in %. Default 5.';
