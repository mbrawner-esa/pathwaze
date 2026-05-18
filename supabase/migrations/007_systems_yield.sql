-- Systems: store yield as an input; annual production becomes derived
ALTER TABLE public.systems
  ADD COLUMN IF NOT EXISTS yield_kwh_kwp NUMERIC;
