-- Permits: add fields needed for full Discretionary / Ministerial register
-- per-permit number, inspector, required flag. Existing columns
-- (ahj, status, submitted_at, approved_at, expiry_date, notes) stay as-is.

ALTER TABLE public.permits
  ADD COLUMN IF NOT EXISTS permit_number TEXT,
  ADD COLUMN IF NOT EXISTS inspector     TEXT,
  ADD COLUMN IF NOT EXISTS required      BOOLEAN DEFAULT TRUE;
