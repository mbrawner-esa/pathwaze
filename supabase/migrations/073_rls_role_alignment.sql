-- 073 — Bring RLS in line with the documented permission model.
--
-- WHY: until now the model described in CLAUDE.md and enforced by
-- src/lib/permissions.ts ("manager sees everything, team sees all projects")
-- lived only in application code. The live policies were the ones written in
-- 001, which predate the manager role entirely:
--
--   manager  -> no policy on any table, so RLS denied everything
--   team     -> only projects where assignee_id = auth.uid()
--
-- That was survivable while every read went through an app route. It is not
-- survivable now that the MCP server (api/mcp) hands a user's own JWT straight
-- to PostgREST and lets RLS decide. This migration makes the database the
-- authority it was always documented to be.
--
-- Also folds in 067 (the manager policy on project_threads), which was written
-- but never run — so this migration stands alone and 067 becomes a no-op.
--
-- SAFETY: additive and SELECT-only. Existing admin / team / investor policies
-- are untouched, and nothing here grants INSERT, UPDATE or DELETE. Postgres
-- policies are permissive (OR'd), so this widens reads and nothing else.
-- Idempotent: every policy is dropped by name before being created.
--
-- ROLLBACK: drop the two policy names from every table listed below.
--   DROP POLICY IF EXISTS "Manager read" ON public.<table>;
--   DROP POLICY IF EXISTS "Team read"    ON public.<table>;

DO $$
DECLARE
  t text;

  -- Tables both managers and team members may read in full.
  shared_tables text[] := ARRAY[
    -- core
    'projects', 'project_notes', 'project_threads', 'activity_log',
    'project_risk', 'portfolio_priority', 'users', 'departments',
    -- tasks
    'tasks', 'task_threads', 'task_files', 'task_links', 'task_departments',
    -- workstreams
    'workstream_majors', 'workstream_major_state', 'workstream_milestones',
    'workstream_milestone_comments', 'workstream_milestone_deps',
    'workstream_milestone_departments', 'workstream_milestone_focus',
    'workstream_milestone_templates', 'workstream_gates',
    'workstream_gate_links', 'workstream_gate_templates', 'workstream_updates',
    -- stakeholders
    'stakeholders', 'stakeholder_tasks', 'stakeholder_feed',
    -- site assets
    'buildings', 'meters', 'systems', 'system_buildings', 'permits',
    'permit_attachments',
    -- pricing
    'offtaker_pricing', 'offtaker_pricing_threads',
    -- drawings + reviews
    'drawings', 'drawing_collections', 'drawing_disciplines', 'drawing_systems',
    'drawing_reviews', 'review_findings', 'review_comments',
    'set_universal_findings', 'action_plans', 'action_plan_sections',
    'action_plan_items',
    -- RFIs
    'rfis', 'rfi_responses', 'rfi_distribution', 'rfi_links', 'rfi_attachments',
    'rfi_response_files',
    -- dataroom
    'dataroom_docs'
  ];

  -- Commercially sensitive: managers only, not the wider team. Mirrors the
  -- existing split where 001 gave team members financials only for their own
  -- assigned projects.
  manager_only_tables text[] := ARRAY[
    'project_financials'
  ];
BEGIN
  FOREACH t IN ARRAY shared_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'skipping %, table not present', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Manager read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.get_user_role() = %L)',
      'Manager read', t, 'manager'
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Team read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.get_user_role() = %L)',
      'Team read', t, 'team'
    );
  END LOOP;

  FOREACH t IN ARRAY manager_only_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'skipping %, table not present', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Manager read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.get_user_role() = %L)',
      'Manager read', t, 'manager'
    );
  END LOOP;
END $$;

-- Deliberately NOT covered by the loops above:
--   email_connections — holds encrypted Outlook refresh tokens. Stays
--                       service-role-only (049). Never exposed over MCP.
--   invited_emails    — admin-only invite management.
--   saved_filters     — per-user UI state; owner policies already exist.
--   investor_access   — grant table; admin-only by design.
--   milestones        — deprecated by 054 and read by nothing.
