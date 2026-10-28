-- 075 — Write support for the MCP server, plus the RLS write gaps it exposes.
--
-- Companion to 073, which aligned READ policies with the documented permission
-- model. This does the same for writes, and adds the guard rails that let the
-- connector create notes, tasks and RFIs safely.
--
-- SAFETY: additive. No existing admin or investor policy is touched. The one
-- replacement (team task writes) is called out below and widens, never narrows.
-- Idempotent: every policy is dropped by name before being created.

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) Manager and team write policies
--
-- 073 was FOR SELECT only, so `manager` still has no write policy on any table:
-- a manager cannot create a note or a task IN THE APP today, never mind over
-- MCP. Team members could write notes but only their own tasks.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  r text;
  write_tables text[] := ARRAY['project_notes', 'tasks', 'task_threads'];
  roles        text[] := ARRAY['manager', 'team'];
BEGIN
  FOREACH t IN ARRAY write_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'skipping %, table not present', t;
      CONTINUE;
    END IF;

    FOREACH r IN ARRAY roles LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r || ' insert', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = %L)',
        r || ' insert', t, r
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r || ' update', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.get_user_role() = %L) WITH CHECK (public.get_user_role() = %L)',
        r || ' update', t, r, r
      );
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) Replace the restrictive team task policy
--
-- 001 limited team task writes to tasks where the member was the assignee, the
-- approver, or the project's assignee. Since 073 lets them READ every project,
-- that produced a confusing split: the same "create a task on Apopka" request
-- worked or failed depending on who owned Apopka, for reasons invisible to the
-- user. Notes and RFIs already had no such limit.
--
-- SELECT is unaffected — 073's "Team read" covers it. DELETE stays narrow:
-- a team member may only delete a task they created or are assigned to.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Team tasks" ON public.tasks;

DROP POLICY IF EXISTS "Team tasks delete" ON public.tasks;
CREATE POLICY "Team tasks delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'team'
    AND (created_by = auth.uid() OR assignee_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- (c) activity_log writes
--
-- Only "Admin full access" existed, so logActivity() has been silently failing
-- for every non-admin — rfi-notify.ts swallows the error in a try/catch and
-- activity.ts never checks it. Team-created notes and tasks have not been
-- reaching the activity feed or the notification bell. Pre-existing bug; fixing
-- it here because MCP writes make it far more visible.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Manager activity insert" ON public.activity_log;
CREATE POLICY "Manager activity insert" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "Team activity insert" ON public.activity_log;
CREATE POLICY "Team activity insert" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'team');

-- ─────────────────────────────────────────────────────────────────────────────
-- (d) created_via — provenance for anything the connector creates
--
-- NULL for every existing row and for anything created in the app. 'mcp' marks
-- connector output, so it can be found, audited and bulk-reverted.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.project_notes ADD COLUMN IF NOT EXISTS created_via text;
ALTER TABLE public.tasks         ADD COLUMN IF NOT EXISTS created_via text;
ALTER TABLE public.rfis          ADD COLUMN IF NOT EXISTS created_via text;

CREATE INDEX IF NOT EXISTS project_notes_created_via_idx ON public.project_notes (created_via);
CREATE INDEX IF NOT EXISTS tasks_created_via_idx         ON public.tasks (created_via);
CREATE INDEX IF NOT EXISTS rfis_created_via_idx          ON public.rfis (created_via);

-- ─────────────────────────────────────────────────────────────────────────────
-- (e) Containment: an MCP-created RFI can never carry an external recipient
--
-- This is the guarantee that matters most. /api/cron/rfi-reminders re-reads RFI
-- rows days after creation and emails the ball-in-court stakeholder plus every
-- rfi_distribution row, so suppressing the email at creation time would simply
-- defer it. Holding the rule in the data means every send path — create, cron,
-- and responses — is structurally incapable of reaching outside ESA.
--
-- The application enforces this twice over (the tool schema has no parameter
-- for it, and the handler nulls the columns). This is the layer that survives
-- an application bug.
--
-- IS DISTINCT FROM, not <>, so existing rows with created_via IS NULL evaluate
-- to true rather than NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.rfis DROP CONSTRAINT IF EXISTS rfis_mcp_no_external_recipients;
ALTER TABLE public.rfis ADD CONSTRAINT rfis_mcp_no_external_recipients
  CHECK (
    created_via IS DISTINCT FROM 'mcp'
    OR (ball_in_court_stakeholder_id IS NULL AND received_from_stakeholder_id IS NULL)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- (f) Idempotency
--
-- A tool call that times out may be retried by the model. Without this a retry
-- creates a second note. The key maps to whatever was created the first time,
-- and the repeat returns that record instead.
-- Service-role-only, like the other mcp_* tables (074).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mcp_idempotency (
  key         text NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool        text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, user_id)
);

ALTER TABLE public.mcp_idempotency ENABLE ROW LEVEL SECURITY;
-- No authenticated policies, by design: service role only.
DROP POLICY IF EXISTS "service only" ON public.mcp_idempotency;
