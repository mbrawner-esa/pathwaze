-- ── Buildings: expanded fields for Areas & Parcels ─────────────────
-- Adds owner / AHJ / zoning / land use / split address
-- plus category-specific physical attributes (year built, sqft, stories, roof).

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS owner_name        TEXT,
  ADD COLUMN IF NOT EXISTS ahj               TEXT,
  ADD COLUMN IF NOT EXISTS zoning_type       TEXT,
  ADD COLUMN IF NOT EXISTS land_use_type     TEXT,
  ADD COLUMN IF NOT EXISTS city              TEXT,
  ADD COLUMN IF NOT EXISTS state             TEXT,
  ADD COLUMN IF NOT EXISTS zip               TEXT,
  -- Conditional physical attributes
  ADD COLUMN IF NOT EXISTS year_built        INTEGER,
  ADD COLUMN IF NOT EXISTS total_sqft        NUMERIC,
  ADD COLUMN IF NOT EXISTS num_stories       INTEGER,
  ADD COLUMN IF NOT EXISTS roof_type         TEXT,
  ADD COLUMN IF NOT EXISTS roof_age          INTEGER,
  ADD COLUMN IF NOT EXISTS roof_manufacturer TEXT;
