-- Add screening question/answer support for job applications

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS screening_questions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS screening_answers JSONB NOT NULL DEFAULT '[]'::jsonb;
