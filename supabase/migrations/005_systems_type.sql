-- Systems: add system_type for design classification
ALTER TABLE public.systems
  ADD COLUMN IF NOT EXISTS system_type TEXT;
