-- Projects: archive support
-- Archived projects are hidden from main list by default;
-- still queryable via /projects?archived=1 toggle.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS projects_archived_at_idx ON public.projects(archived_at);
