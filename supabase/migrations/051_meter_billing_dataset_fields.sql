-- 051_meter_billing_dataset_fields.sql
-- Adds usage-dataset capture fields to the per-meter "Usage & Rate" section:
--   data_type           — how usage was captured (Annual Bills / Interval Data 30 or 60 Min)
--   billing_start_year  — first year of the billing/usage dataset
--   billing_start_month — first month of the billing/usage dataset
-- Stored as text to match the DrawerSelect dropdown pattern used in the meter drawer.
alter table meters add column if not exists data_type text;
alter table meters add column if not exists billing_start_year text;
alter table meters add column if not exists billing_start_month text;
