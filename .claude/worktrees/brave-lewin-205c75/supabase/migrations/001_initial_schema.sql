-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (synced from auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin', 'team', 'investor')) DEFAULT 'team',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  customer TEXT NOT NULL DEFAULT 'AdventHealth',
  stage TEXT NOT NULL DEFAULT 'Prospecting',
  deal_health TEXT NOT NULL DEFAULT 'TBD',
  system_kwdc NUMERIC NOT NULL DEFAULT 0,
  system_kwac NUMERIC NOT NULL DEFAULT 0,
  annual_production_kwh NUMERIC NOT NULL DEFAULT 0,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  lat NUMERIC,
  lng NUMERIC,
  utility TEXT NOT NULL DEFAULT '',
  rate_schedule TEXT NOT NULL DEFAULT '',
  rate_schedule_type TEXT NOT NULL DEFAULT '',
  annual_usage_kwh NUMERIC DEFAULT 0,
  peak_demand_kw NUMERIC DEFAULT 0,
  interconnection_num TEXT DEFAULT 'TBD',
  interconnection_status TEXT DEFAULT 'Not Started',
  interconnection_voltage TEXT DEFAULT 'TBD',
  interconnection_feasibility TEXT DEFAULT 'TBD',
  interconnection_cost_estimate NUMERIC DEFAULT 0,
  nem_program TEXT DEFAULT 'TBD',
  utility_poc TEXT DEFAULT 'TBD',
  ahj TEXT DEFAULT 'TBD',
  building_permit_num TEXT DEFAULT 'TBD',
  building_permit_status TEXT DEFAULT 'Not Started',
  electrical_permit_num TEXT DEFAULT 'TBD',
  permit_submitted DATE,
  permit_approved DATE,
  inspector TEXT DEFAULT 'TBD',
  assignee_id UUID REFERENCES public.users(id),
  facility_type TEXT DEFAULT '',
  site_type TEXT DEFAULT '',
  site_acres NUMERIC DEFAULT 0,
  roof_type TEXT DEFAULT '',
  modules TEXT DEFAULT 'TBD',
  inverters TEXT DEFAULT 'TBD',
  monitoring TEXT DEFAULT 'TBD',
  azimuth TEXT DEFAULT 'TBD',
  tilt TEXT DEFAULT 'TBD',
  region TEXT DEFAULT '',
  tranche TEXT DEFAULT '',
  start_date DATE,
  target_cod TEXT DEFAULT 'TBD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project Financials (one-to-one with projects)
CREATE TABLE public.project_financials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  total_cost NUMERIC DEFAULT 0,
  itc_eligible_costs NUMERIC DEFAULT 0,
  itc_ineligible_costs NUMERIC DEFAULT 0,
  estimated_epc_cost NUMERIC DEFAULT 0,
  estimated_dev_costs NUMERIC DEFAULT 0,
  estimated_ix_costs NUMERIC DEFAULT 0,
  development_fee NUMERIC DEFAULT 0,
  itc_rate NUMERIC DEFAULT 30,
  domestic_content_assumed BOOLEAN DEFAULT false,
  safe_harbor_required BOOLEAN DEFAULT false,
  other_incentives_total NUMERIC DEFAULT 0,
  incentive_type TEXT DEFAULT 'None',
  contract_type TEXT DEFAULT 'Energy Services Agreement',
  revenue_type TEXT DEFAULT 'Fixed Rate with Escalator',
  offtaker_credit TEXT DEFAULT 'AA - IG',
  term_months INTEGER DEFAULT 360,
  year1_contract_price NUMERIC DEFAULT 0,
  escalation_rate NUMERIC DEFAULT 2,
  srec_treatment TEXT DEFAULT 'Offtaker Retains',
  avoided_cost_kwh NUMERIC DEFAULT 0,
  yield_kwh_kwp NUMERIC DEFAULT 0,
  energy_gen_year1_mwh NUMERIC DEFAULT 0,
  system_type TEXT DEFAULT '',
  annual_savings NUMERIC DEFAULT 0,
  payback_years NUMERIC DEFAULT 0
);

-- Milestones
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  target_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'Administrative',
  status TEXT NOT NULL DEFAULT 'Draft',
  priority TEXT NOT NULL DEFAULT 'Medium',
  assignee_id UUID REFERENCES public.users(id),
  approver_id UUID REFERENCES public.users(id),
  requires_approval BOOLEAN DEFAULT false,
  approval_status TEXT,
  approval_notes TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Threads (comments)
CREATE TABLE public.task_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stakeholders
CREATE TABLE public.stakeholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT DEFAULT '',
  department TEXT DEFAULT '',
  role TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  sentiment TEXT DEFAULT 'Neutral',
  is_primary BOOLEAN DEFAULT false,
  org TEXT DEFAULT ''
);

-- Stakeholder Tasks
CREATE TABLE public.stakeholder_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT false
);

-- Stakeholder Feed
CREATE TABLE public.stakeholder_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_name TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  subject TEXT,
  from_addr TEXT,
  to_addr TEXT
);

-- Dataroom Docs
CREATE TABLE public.dataroom_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  subcategory_id TEXT NOT NULL DEFAULT '',
  doc_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  box_file_id TEXT,
  file_name TEXT,
  uploaded_by UUID REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(project_id, category_id, doc_name)
);

-- Activity Log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Permits
CREATE TABLE public.permits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Required',
  level TEXT NOT NULL DEFAULT 'Local',
  status TEXT NOT NULL DEFAULT 'Not Started',
  ahj TEXT,
  submitted_at DATE,
  approved_at DATE,
  expiry_date DATE,
  notes TEXT
);

-- Investor Access
CREATE TABLE public.investor_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  tranche TEXT,
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(investor_id, project_id)
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sync auth users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', ''), COALESCE(new.raw_user_meta_data->>'role', 'team'))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholder_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholder_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataroom_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_access ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policies: Admin full access
CREATE POLICY "Admin full access" ON public.projects FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.project_financials FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.milestones FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.tasks FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.task_threads FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.stakeholders FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.stakeholder_tasks FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.stakeholder_feed FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.dataroom_docs FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.activity_log FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.permits FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.users FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin full access" ON public.investor_access FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Team: read/write on assigned projects
CREATE POLICY "Team project access" ON public.projects FOR ALL TO authenticated
  USING (public.get_user_role() = 'team' AND assignee_id = auth.uid());
CREATE POLICY "Team financials" ON public.project_financials FOR SELECT TO authenticated
  USING (public.get_user_role() = 'team' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assignee_id = auth.uid()));
CREATE POLICY "Team milestones" ON public.milestones FOR ALL TO authenticated
  USING (public.get_user_role() = 'team' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assignee_id = auth.uid()));
CREATE POLICY "Team tasks" ON public.tasks FOR ALL TO authenticated
  USING (public.get_user_role() = 'team' AND (assignee_id = auth.uid() OR approver_id = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE assignee_id = auth.uid())));
CREATE POLICY "Team task threads" ON public.task_threads FOR ALL TO authenticated
  USING (public.get_user_role() = 'team');
CREATE POLICY "Team stakeholders" ON public.stakeholders FOR ALL TO authenticated
  USING (public.get_user_role() = 'team');
CREATE POLICY "Team stakeholder tasks" ON public.stakeholder_tasks FOR ALL TO authenticated
  USING (public.get_user_role() = 'team');
CREATE POLICY "Team stakeholder feed" ON public.stakeholder_feed FOR ALL TO authenticated
  USING (public.get_user_role() = 'team');
CREATE POLICY "Team dataroom" ON public.dataroom_docs FOR ALL TO authenticated
  USING (public.get_user_role() = 'team' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assignee_id = auth.uid()));
CREATE POLICY "Team permits" ON public.permits FOR ALL TO authenticated
  USING (public.get_user_role() = 'team' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assignee_id = auth.uid()));

-- Investor: read-only on approved docs and their projects
CREATE POLICY "Investor projects" ON public.projects FOR SELECT TO authenticated
  USING (public.get_user_role() = 'investor' AND id IN (SELECT project_id FROM public.investor_access WHERE investor_id = auth.uid()));
CREATE POLICY "Investor financials" ON public.project_financials FOR SELECT TO authenticated
  USING (public.get_user_role() = 'investor' AND project_id IN (SELECT project_id FROM public.investor_access WHERE investor_id = auth.uid()));
CREATE POLICY "Investor milestones" ON public.milestones FOR SELECT TO authenticated
  USING (public.get_user_role() = 'investor' AND project_id IN (SELECT project_id FROM public.investor_access WHERE investor_id = auth.uid()));
CREATE POLICY "Investor dataroom" ON public.dataroom_docs FOR SELECT TO authenticated
  USING (public.get_user_role() = 'investor' AND status = 'approved' AND project_id IN (SELECT project_id FROM public.investor_access WHERE investor_id = auth.uid()));

-- Users can read own data
CREATE POLICY "Users read own" ON public.users FOR SELECT TO authenticated USING (id = auth.uid() OR public.get_user_role() = 'admin' OR public.get_user_role() = 'team');
