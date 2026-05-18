-- Project contact: link to a stakeholder of this project
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS primary_stakeholder_id UUID REFERENCES public.stakeholders(id) ON DELETE SET NULL;

-- Migrate legacy stage values to the new development stage taxonomy
UPDATE public.projects SET stage = 'Pre-Planning'        WHERE stage = 'Prospecting';
UPDATE public.projects SET stage = 'Design Development'  WHERE stage = 'Proposal';
UPDATE public.projects SET stage = 'Pre-Closing'         WHERE stage = 'Contracting';
UPDATE public.projects SET stage = 'NTP'                 WHERE stage = 'Permitting';
UPDATE public.projects SET stage = 'Active Construction' WHERE stage = 'Construction';
UPDATE public.projects SET stage = 'Operating'           WHERE stage = 'Operations';
-- 'Archived' kept as-is
