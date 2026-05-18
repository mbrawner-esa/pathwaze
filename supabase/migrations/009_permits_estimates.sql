-- Permits: planning estimates
ALTER TABLE public.permits
  ADD COLUMN IF NOT EXISTS est_cost        NUMERIC,
  ADD COLUMN IF NOT EXISTS est_review_days INTEGER;
