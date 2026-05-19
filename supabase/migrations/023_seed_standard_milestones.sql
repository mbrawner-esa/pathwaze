-- Seed the 19 standard solar BTM lifecycle milestones for every project.
-- Uses NOT EXISTS guard so re-running is idempotent and existing custom
-- milestones for any project remain untouched.

WITH standard AS (
  SELECT * FROM (VALUES
    ( 1, 'Site Plan Approval'),
    ( 2, 'LNTP - Financial Approval'),
    ( 3, 'Data Intake Complete'),
    ( 4, 'Site Survey Complete'),
    ( 5, 'Design Development Complete'),
    ( 6, 'EPC RFP Round 1 Complete'),
    ( 7, 'Utility Notice to Proceed'),
    ( 8, 'EPC RFP Round 2 Complete'),
    ( 9, 'Site Control Executed'),
    (10, 'Revenue Agreement Executed'),
    (11, 'Interconnection Agreement Executed'),
    (12, 'EPC LNTP'),
    (13, 'NTP'),
    (14, 'Engineering Complete'),
    (15, 'Permit Approved'),
    (16, 'Construction Commencement'),
    (17, 'Mechanical Completion'),
    (18, 'Substantial Completion'),
    (19, 'COD')
  ) AS s(sort_order, label)
)
INSERT INTO public.milestones (project_id, label, sort_order, status, completed)
SELECT p.id, s.label, s.sort_order, 'Not Started', FALSE
FROM public.projects p
CROSS JOIN standard s
WHERE NOT EXISTS (
  SELECT 1 FROM public.milestones m
  WHERE m.project_id = p.id AND m.label = s.label
);
