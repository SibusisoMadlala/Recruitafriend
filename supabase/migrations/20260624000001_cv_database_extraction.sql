-- ============================================================
-- CV Database + AI Extraction support
-- ============================================================

-- Add CV extraction columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv_text               TEXT,
  ADD COLUMN IF NOT EXISTS cv_ai_summary         TEXT,
  ADD COLUMN IF NOT EXISTS cv_job_titles         JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cv_qualifications     JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cv_certifications     JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cv_industries         JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cv_languages          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cv_driver_licence     BOOLEAN,
  ADD COLUMN IF NOT EXISTS cv_years_experience   INT,
  ADD COLUMN IF NOT EXISTS cv_salary_expectations TEXT,
  ADD COLUMN IF NOT EXISTS cv_availability       TEXT,
  ADD COLUMN IF NOT EXISTS cv_extracted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_cv                BOOLEAN NOT NULL DEFAULT FALSE;

-- Allow any authenticated user to read public seeker profiles
-- (used by CV Database, AI Talent Match)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_read_seekers_public'
  ) THEN
    CREATE POLICY "profiles_read_seekers_public"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (user_type = 'seeker');
  END IF;
END
$$;

-- Allow authenticated users to see cv_files records
-- so CV database can show who has uploaded a CV
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cv_files' AND policyname = 'cv_files_read_authenticated'
  ) THEN
    CREATE POLICY "cv_files_read_authenticated"
      ON public.cv_files FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;
END
$$;

-- Index for fast CV database queries
CREATE INDEX IF NOT EXISTS idx_profiles_has_cv    ON public.profiles (has_cv) WHERE has_cv = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles (user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_name      ON public.profiles (name);
