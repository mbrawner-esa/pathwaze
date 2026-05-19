-- Schedule tab scaffolding — additive only, safe on production.
-- - tasks.parent_task_id → 2-level subtask hierarchy
-- - tasks.show_on_schedule → opt-in flag for Schedule tab visibility
-- - tasks.end_date → task duration (start_date already exists)
-- - milestones.status, milestones.notes → richer milestone records

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id   UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS show_on_schedule BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS end_date         DATE;

CREATE INDEX IF NOT EXISTS tasks_parent_task_idx ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_schedule_idx   ON public.tasks(project_id, show_on_schedule) WHERE show_on_schedule = TRUE;

-- Enforce 2-level nesting: a subtask can't itself have subtasks
-- (i.e. parent_task_id refers to a top-level task, not another subtask)
CREATE OR REPLACE FUNCTION public.enforce_task_2_level_nesting()
RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = NEW.parent_task_id AND parent_task_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Subtasks cannot have their own subtasks (2-level nesting limit)';
    END IF;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_task_nesting ON public.tasks;
CREATE TRIGGER enforce_task_nesting
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_2_level_nesting();

-- Milestones: richer fields
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Not Started',  -- Not Started | At Risk | Hit | Missed
  ADD COLUMN IF NOT EXISTS notes TEXT;
