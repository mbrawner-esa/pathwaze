-- 077 — projects.system_kwdc / system_kwac / annual_production_kwh become
-- derived columns, computed from the project's APPROVED systems.
--
-- WHY: the three columns were typed in by hand on the project record and also
-- rolled up from `systems` on the Technical tab and the project list, so the
-- same project could carry two different System Sizes depending on where you
-- looked. The roll-up also counted every design regardless of status, so a
-- project with one approved 500 kW design and three 500 kW drafts read as
-- 2,000 kW. The Technical tab's systems table is the record; a hand-typed
-- figure on the project row is not.
--
-- WHAT: the systems table is now the only writer. A BEFORE INSERT/UPDATE
-- trigger on `projects` overwrites whatever a caller sends for the three
-- columns with the sum over that project's systems where
-- design_status = 'Approved'; an AFTER trigger on `systems` re-runs the sum
-- whenever a design is added, edited, re-statused, moved or removed. A project
-- with no approved design totals 0.
--
-- WHO: nobody — not even admin, and not the service role. This is deliberately
-- stronger than the role checks in 076: the columns are no longer data anyone
-- enters, so there is no role that may enter them. The app's own write paths
-- (the project summary card, the Technical tab specs card, POST /api/projects
-- and the PATCH whitelist) were removed in the same change; this makes that
-- hold for direct PostgREST calls, scripts and `supabase/seed.ts` too.
--
-- SAFETY: no column is added or dropped, so every existing reader keeps
-- working and simply starts seeing the derived number. (d) backfills the
-- portfolio in one statement — expect project sizes to CHANGE the moment this
-- runs, and to drop to 0 on any project whose designs are not yet marked
-- Approved. That is the point, but it is worth a look before and after:
--   SELECT project_number, name, system_kwdc FROM public.projects ORDER BY name;
-- Idempotent throughout.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS projects_system_totals ON public.projects;
--   DROP TRIGGER IF EXISTS systems_project_totals ON public.systems;
--   DROP FUNCTION IF EXISTS public.force_project_system_totals();
--   DROP FUNCTION IF EXISTS public.sync_project_system_totals();
--   DROP FUNCTION IF EXISTS public.recalc_project_system_totals(uuid);
--   (the values stay as last computed; they become hand-editable again)

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) The sum, in one place
--
-- SECURITY DEFINER because this runs from a trigger on `systems`: a team
-- member may edit a design without holding UPDATE on `projects`, and an RLS
-- refusal there would silently update zero rows rather than error.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalc_project_system_totals(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_project_id IS NULL THEN RETURN; END IF;

  UPDATE public.projects p
     SET system_kwdc           = t.dc,
         system_kwac           = t.ac,
         annual_production_kwh = t.prod
    FROM (
      SELECT COALESCE(SUM(size_kwdc), 0)             AS dc,
             COALESCE(SUM(size_kwac), 0)             AS ac,
             COALESCE(SUM(annual_production_kwh), 0) AS prod
        FROM public.systems
       WHERE project_id = p_project_id
         AND design_status = 'Approved'
    ) t
   WHERE p.id = p_project_id
     AND (p.system_kwdc, p.system_kwac, p.annual_production_kwh)
         IS DISTINCT FROM (t.dc, t.ac, t.prod);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) Writes to `projects` cannot change the three columns
--
-- The incoming value is replaced, not rejected: a PATCH that happens to carry
-- system_kwdc alongside a dozen legitimate fields still succeeds, it just does
-- not move the number. On INSERT the project has no systems yet, so this
-- settles the row at 0.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.force_project_system_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dc numeric; ac numeric; prod numeric;
BEGIN
  SELECT COALESCE(SUM(size_kwdc), 0),
         COALESCE(SUM(size_kwac), 0),
         COALESCE(SUM(annual_production_kwh), 0)
    INTO dc, ac, prod
    FROM public.systems
   WHERE project_id = NEW.id
     AND design_status = 'Approved';

  NEW.system_kwdc           := dc;
  NEW.system_kwac           := ac;
  NEW.annual_production_kwh := prod;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_system_totals ON public.projects;
CREATE TRIGGER projects_system_totals
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.force_project_system_totals();

-- ─────────────────────────────────────────────────────────────────────────────
-- (c) A design change re-totals its project
--
-- Covers the row moving between projects, which has to re-total both the one
-- it left and the one it joined.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_project_system_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_system_totals(OLD.project_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalc_project_system_totals(NEW.project_id);
  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    PERFORM public.recalc_project_system_totals(OLD.project_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS systems_project_totals ON public.systems;
CREATE TRIGGER systems_project_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.systems
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_system_totals();

-- ─────────────────────────────────────────────────────────────────────────────
-- (d) Backfill every project to its approved total
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.projects p
   SET system_kwdc           = t.dc,
       system_kwac           = t.ac,
       annual_production_kwh = t.prod
  FROM (
    SELECT pr.id,
           COALESCE(SUM(s.size_kwdc), 0)             AS dc,
           COALESCE(SUM(s.size_kwac), 0)             AS ac,
           COALESCE(SUM(s.annual_production_kwh), 0) AS prod
      FROM public.projects pr
      LEFT JOIN public.systems s
        ON s.project_id = pr.id
       AND s.design_status = 'Approved'
     GROUP BY pr.id
  ) t
 WHERE p.id = t.id;
