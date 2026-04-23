-- Add explicit visibility control for employer job posts.
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;

-- Ensure existing rows are visible by default.
UPDATE public.jobs
SET is_visible = true
WHERE is_visible IS NULL;

-- Public visibility should require active + visible.
DROP POLICY IF EXISTS "jobs_select_active" ON public.jobs;

CREATE POLICY "jobs_select_active"
  ON public.jobs FOR SELECT
  USING ((status = 'active' AND is_visible = true) OR auth.uid() = employer_id);

CREATE INDEX IF NOT EXISTS idx_jobs_status_visible
  ON public.jobs (status, is_visible);
