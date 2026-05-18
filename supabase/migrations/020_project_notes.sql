-- Project notes/events/files — user-authored items in the project activity feed.

CREATE TABLE IF NOT EXISTS public.project_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'note',  -- note | event | file
  title TEXT,
  body TEXT,
  event_date DATE,
  storage_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_notes_project_idx
  ON public.project_notes(project_id, created_at DESC);

ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.project_notes
  FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Team project notes" ON public.project_notes
  FOR ALL TO authenticated USING (public.get_user_role() = 'team');

-- Storage bucket for project file uploads (notes/events of type='file')
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "project_files_select" ON storage.objects;
DROP POLICY IF EXISTS "project_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "project_files_delete" ON storage.objects;
CREATE POLICY "project_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');
CREATE POLICY "project_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files');
CREATE POLICY "project_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files');
