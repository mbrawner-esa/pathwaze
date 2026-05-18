-- ── Site Assets: Buildings / Meters / Systems ─────────────────────
-- Phase 3 tables: areas/parcels, utility meters, solar systems.
-- Relationships: System → Building (optional), System → Meter (optional),
-- Meter → Building (optional). All cascade-delete with project.

-- ── buildings (areas & parcels) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Building',
    -- Building | Parking Lot | Garage | Field | Other
  parcel_id TEXT,
  address TEXT,
  county TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buildings_project_idx ON public.buildings(project_id);

-- ── meters ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
  meter_num TEXT NOT NULL,
  account_num TEXT,
  utility TEXT,
  rate_schedule TEXT,
  annual_usage_kwh NUMERIC,
  peak_demand_kw NUMERIC,
  blended_rate NUMERIC,
  annual_spend NUMERIC,
  status TEXT DEFAULT 'Active',
  included BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meters_project_idx ON public.meters(project_id);
CREATE INDEX IF NOT EXISTS meters_building_idx ON public.meters(building_id);

-- ── systems (solar designs) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
  meter_id UUID REFERENCES public.meters(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  design_version TEXT DEFAULT 'v1.0',
  design_status TEXT DEFAULT 'Not Started',
    -- Not Started | In Progress | Under Review | Approved
  size_kwdc NUMERIC DEFAULT 0,
  size_kwac NUMERIC DEFAULT 0,
  annual_production_kwh NUMERIC DEFAULT 0,
  performance_ratio NUMERIC DEFAULT 0.80,
  modules TEXT,
  inverters TEXT,
  monitoring TEXT,
  racking TEXT,
  azimuth TEXT,
  tilt TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS systems_project_idx ON public.systems(project_id);
CREATE INDEX IF NOT EXISTS systems_building_idx ON public.systems(building_id);
CREATE INDEX IF NOT EXISTS systems_meter_idx ON public.systems(meter_id);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systems   ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin full access" ON public.buildings FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.meters    FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.systems   FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Team: access on assigned projects
CREATE POLICY "Team buildings" ON public.buildings FOR ALL TO authenticated
  USING (public.get_user_role() = 'team' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assignee_id = auth.uid()));
CREATE POLICY "Team meters" ON public.meters FOR ALL TO authenticated
  USING (public.get_user_role() = 'team' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assignee_id = auth.uid()));
CREATE POLICY "Team systems" ON public.systems FOR ALL TO authenticated
  USING (public.get_user_role() = 'team' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assignee_id = auth.uid()));
