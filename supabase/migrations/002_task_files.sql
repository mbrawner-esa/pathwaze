-- Task Files
-- Stores metadata for files attached to a task. Files can be:
--   (a) uploaded to Supabase Storage (storage_path set), or
--   (b) external links (file_url set, e.g. Box / Drive / Dropbox URL)

CREATE TABLE IF NOT EXISTS public.task_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,                    -- external link (Box, Drive, etc.)
  storage_path TEXT,                -- Supabase Storage object path (when uploaded)
  file_size BIGINT,
  content_type TEXT,
  uploaded_by UUID REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_files_task_id_idx ON public.task_files(task_id);
CREATE INDEX IF NOT EXISTS task_files_uploaded_at_idx ON public.task_files(uploaded_at DESC);

-- ── Storage bucket for task file uploads ──────────────────────────
-- Bucket is private; downloads use signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: any authenticated user can upload, read, and delete in this bucket.
-- (Tighter per-task policies can be added later when team-level access matters.)
DROP POLICY IF EXISTS "task_files_select" ON storage.objects;
DROP POLICY IF EXISTS "task_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_files_delete" ON storage.objects;

CREATE POLICY "task_files_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-files');

CREATE POLICY "task_files_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-files');

CREATE POLICY "task_files_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-files');
