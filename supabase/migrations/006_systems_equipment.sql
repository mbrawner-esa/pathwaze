-- Systems: equipment counts + design link
ALTER TABLE public.systems
  ADD COLUMN IF NOT EXISTS num_modules     INTEGER,
  ADD COLUMN IF NOT EXISTS num_inverters   INTEGER,
  ADD COLUMN IF NOT EXISTS module_wattage  NUMERIC,   -- Watts per module
  ADD COLUMN IF NOT EXISTS inverter_rating NUMERIC,   -- kW per inverter
  ADD COLUMN IF NOT EXISTS design_url      TEXT;     -- Helioscope / PVSyst / etc.
