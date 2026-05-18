-- Permits: project-phase stage tagging
-- Pre-NTP | NTP | Pre-Construction | Post-Construction
ALTER TABLE public.permits
  ADD COLUMN IF NOT EXISTS stage TEXT;
