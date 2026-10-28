-- 076 — Recoverable delete for project notes and RFIs.
--
-- WHY: neither notes nor RFIs had a delete path in the UI, so removing a test
-- record meant going in through the service role. Two things were wrong
-- underneath that:
--
--   1. project_notes carried a FOR ALL policy for the team role (020), so any
--      team member could already HARD delete any note — permanently, with no
--      confirmation and no recovery. There was even an unreferenced DELETE
--      route (api/projects/[id]/notes/[noteId]) with no role check of its own.
--   2. rfis had no write policy for manager at all, so a manager could not
--      delete one even if the UI offered it.
--
-- WHAT: soft delete. A deleted record keeps its row and its RFI number; it
-- simply stops being visible. Deleting and restoring are both "set a column",
-- which is why this needs no DELETE policy anywhere.
--
-- WHO: admin and manager. Enforced by a trigger rather than a policy, because
-- RLS cannot express "you may UPDATE this row but not this column" — manager
-- and team both hold UPDATE on project_notes from 075.
--
-- SAFETY: additive except for dropping the over-broad team policy in (b),
-- which REMOVES a capability (hard delete) rather than granting one. Team
-- reads/inserts/updates on notes are unaffected — 073 and 075 cover them.
-- Idempotent throughout.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS project_notes_soft_delete_role ON public.project_notes;
--   DROP TRIGGER IF EXISTS rfis_soft_delete_role ON public.rfis;
--   DROP FUNCTION IF EXISTS public.enforce_soft_delete_role();
--   DROP POLICY IF EXISTS "Hide deleted" ON public.project_notes;
--   DROP POLICY IF EXISTS "Hide deleted" ON public.rfis;
--   (the columns can stay; nothing breaks if they do)

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) The columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.project_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.project_notes ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);
ALTER TABLE public.rfis          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.rfis          ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

-- Partial indexes: every normal list filters deleted_at IS NULL, and the
-- recycle bin is the rare query.
CREATE INDEX IF NOT EXISTS project_notes_live_idx
  ON public.project_notes (project_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS rfis_live_idx
  ON public.rfis (project_id, created_at DESC) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) Close the hard-delete hole on notes
--
-- "Team project notes" (020) was FOR ALL, which includes DELETE. Everything it
-- legitimately granted is now covered elsewhere: SELECT by 073's "Team read",
-- INSERT and UPDATE by 075's "team insert" / "team update". Dropping it leaves
-- team members exactly as capable as they are today, minus the ability to
-- destroy a note irrecoverably.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Team project notes" ON public.project_notes;

-- ─────────────────────────────────────────────────────────────────────────────
-- (c) Let admin and manager write RFIs
--
-- 073 gave both roles SELECT on rfis; neither ever got UPDATE. Without this a
-- manager cannot set deleted_at, so the delete button would fail for exactly
-- the role we are adding it for.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin', 'manager'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.rfis', r || ' update');
    EXECUTE format(
      'CREATE POLICY %I ON public.rfis FOR UPDATE TO authenticated '
      || 'USING (public.get_user_role() = %L) WITH CHECK (public.get_user_role() = %L)',
      r || ' update', r, r
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (d) Deleted rows disappear for everyone who cannot restore them
--
-- RESTRICTIVE, so it ANDs with every other policy instead of widening access:
-- a soft-deleted note or RFI is simply not there for team and investor, on
-- every path at once — the app, the activity feed, and the MCP connector's
-- generic query_table. Admin and manager still see them, which is what makes
-- the recycle bin and Restore possible.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Hide deleted" ON public.project_notes;
CREATE POLICY "Hide deleted" ON public.project_notes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.get_user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "Hide deleted" ON public.rfis;
CREATE POLICY "Hide deleted" ON public.rfis
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.get_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- (e) Only admin and manager may delete or restore
--
-- The policies above cannot express this: manager and team share one UPDATE
-- grant on project_notes, and RLS has no column-level USING clause. A trigger
-- can, and it holds on every path — the app route, a direct PostgREST call, or
-- anything added later.
--
-- Service-role callers (migrations, scripts, cron) have no role and are let
-- through deliberately: they already bypass RLS entirely, so refusing them
-- here would buy nothing and would break any future purge job.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_soft_delete_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  who text;
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    who := public.get_user_role();
    IF who IS NOT NULL AND who NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'Only an admin or manager can delete or restore this record';
    END IF;
    -- Keep deleted_by honest: it is whoever flipped the column, not whatever
    -- the caller claimed.
    IF NEW.deleted_at IS NULL THEN
      NEW.deleted_by := NULL;
    ELSE
      NEW.deleted_by := COALESCE(auth.uid(), NEW.deleted_by);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_notes_soft_delete_role ON public.project_notes;
CREATE TRIGGER project_notes_soft_delete_role
  BEFORE UPDATE ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_soft_delete_role();

DROP TRIGGER IF EXISTS rfis_soft_delete_role ON public.rfis;
CREATE TRIGGER rfis_soft_delete_role
  BEFORE UPDATE ON public.rfis
  FOR EACH ROW EXECUTE FUNCTION public.enforce_soft_delete_role();
