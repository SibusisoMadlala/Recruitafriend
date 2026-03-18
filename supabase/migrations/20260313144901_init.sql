-- ============================================================
-- RecruitFriend initial schema
-- ============================================================

-- -------------------------------------------------------
-- 1. PROFILES (extends auth.users)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT,
  user_type     TEXT NOT NULL CHECK (user_type IN ('seeker', 'employer')),
  subscription  TEXT NOT NULL DEFAULT 'FREE',
  headline      TEXT,
  summary       TEXT,
  phone         TEXT,
  location      TEXT,
  avatar_url    TEXT,
  skills        JSONB NOT NULL DEFAULT '[]',
  experience    JSONB NOT NULL DEFAULT '[]',
  education     JSONB NOT NULL DEFAULT '[]',
  social_links  JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 2. JOBS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  industry         TEXT,
  category         TEXT,
  employment_type  TEXT,
  work_location    TEXT,
  province         TEXT,
  city             TEXT,
  salary_min       INT,
  salary_max       INT,
  description      TEXT,
  requirements     TEXT[] NOT NULL DEFAULT '{}',
  benefits         TEXT[] NOT NULL DEFAULT '{}',
  interview_type   TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'closed', 'draft')),
  views            INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 3. APPLICATIONS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  seeker_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_letter  TEXT,
  custom_letter TEXT,
  status        TEXT NOT NULL DEFAULT 'applied'
                  CHECK (status IN ('applied', 'viewed', 'shortlisted', 'interview', 'offer', 'rejected')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, seeker_id)
);

-- -------------------------------------------------------
-- 4. SAVED JOBS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seeker_id, job_id)
);

-- -------------------------------------------------------
-- 5. ROW LEVEL SECURITY — enable on all tables
-- -------------------------------------------------------
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs  ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 6. RLS POLICIES — profiles
-- -------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow insert from trigger (service role bypasses RLS; anon trigger path)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Service role needs unrestricted access (used by Edge Function)
-- The service-role key bypasses RLS automatically — no extra policy needed.

-- -------------------------------------------------------
-- 7. RLS POLICIES — jobs
-- -------------------------------------------------------
DROP POLICY IF EXISTS "jobs_select_active" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_employer" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_own" ON public.jobs;

-- Anyone can read active jobs (public job board)
CREATE POLICY "jobs_select_active"
  ON public.jobs FOR SELECT
  USING (status = 'active' OR auth.uid() = employer_id);

-- Only employers can insert
CREATE POLICY "jobs_insert_employer"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = employer_id);

-- Employers can update their own jobs
CREATE POLICY "jobs_update_own"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = employer_id);

-- Employers can delete their own jobs
CREATE POLICY "jobs_delete_own"
  ON public.jobs FOR DELETE
  USING (auth.uid() = employer_id);

-- -------------------------------------------------------
-- 8. RLS POLICIES — applications
-- -------------------------------------------------------
DROP POLICY IF EXISTS "applications_select_seeker" ON public.applications;
DROP POLICY IF EXISTS "applications_insert_seeker" ON public.applications;
DROP POLICY IF EXISTS "applications_update_employer" ON public.applications;

-- Seekers can read their own applications
CREATE POLICY "applications_select_seeker"
  ON public.applications FOR SELECT
  USING (
    auth.uid() = seeker_id
    OR auth.uid() IN (
      SELECT employer_id FROM public.jobs WHERE id = job_id
    )
  );

-- Seekers can create applications
CREATE POLICY "applications_insert_seeker"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = seeker_id);

-- Employer can update application status
CREATE POLICY "applications_update_employer"
  ON public.applications FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT employer_id FROM public.jobs WHERE id = job_id
    )
  );

-- -------------------------------------------------------
-- 9. RLS POLICIES — saved_jobs
-- -------------------------------------------------------
DROP POLICY IF EXISTS "saved_jobs_select_own" ON public.saved_jobs;
DROP POLICY IF EXISTS "saved_jobs_insert_own" ON public.saved_jobs;
DROP POLICY IF EXISTS "saved_jobs_delete_own" ON public.saved_jobs;

CREATE POLICY "saved_jobs_select_own"
  ON public.saved_jobs FOR SELECT
  USING (auth.uid() = seeker_id);

CREATE POLICY "saved_jobs_insert_own"
  ON public.saved_jobs FOR INSERT
  WITH CHECK (auth.uid() = seeker_id);

CREATE POLICY "saved_jobs_delete_own"
  ON public.saved_jobs FOR DELETE
  USING (auth.uid() = seeker_id);

-- -------------------------------------------------------
-- 10. TRIGGER — auto-create profile on signup
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, user_type, subscription)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'userType', 'seeker'),
    CASE
      WHEN NEW.raw_user_meta_data->>'userType' = 'employer' THEN 'STARTER'
      ELSE 'FREE'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------
-- 11. INDEXES (performance)
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id    ON public.jobs (employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status         ON public.jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at     ON public.jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_seeker ON public.applications (seeker_id);
CREATE INDEX IF NOT EXISTS idx_applications_job    ON public.applications (job_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_seeker   ON public.saved_jobs (seeker_id);
