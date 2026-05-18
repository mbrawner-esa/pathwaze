-- Meters: per-meter interconnection application fields
-- One IX application per meter, replacing the project-level IX summary.
ALTER TABLE public.meters
  ADD COLUMN IF NOT EXISTS ix_app_num         TEXT,
  ADD COLUMN IF NOT EXISTS ix_status          TEXT,
  ADD COLUMN IF NOT EXISTS ix_voltage         TEXT,
  ADD COLUMN IF NOT EXISTS ix_feasibility     TEXT,
  ADD COLUMN IF NOT EXISTS ix_cost_estimate   NUMERIC;
