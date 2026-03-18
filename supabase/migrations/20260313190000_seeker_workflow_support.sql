-- ============================================================
-- Seeker workflow support tables (alerts, CV settings/files, referrals)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.job_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords    TEXT NOT NULL,
  location    TEXT,
  min_salary  INT,
  frequency   TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'immediately')),
  types       TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cv_settings (
  seeker_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  template        TEXT NOT NULL DEFAULT 'classic' CHECK (template IN ('classic', 'modern', 'bold')),
  visibility      BOOLEAN NOT NULL DEFAULT true,
  last_synced_at  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cv_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_size   BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_email TEXT,
  status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'signed_up', 'hired')),
  payout        NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_alerts_select_own" ON public.job_alerts;
DROP POLICY IF EXISTS "job_alerts_insert_own" ON public.job_alerts;
DROP POLICY IF EXISTS "job_alerts_update_own" ON public.job_alerts;
DROP POLICY IF EXISTS "job_alerts_delete_own" ON public.job_alerts;

CREATE POLICY "job_alerts_select_own"
  ON public.job_alerts FOR SELECT
  USING (auth.uid() = seeker_id);
CREATE POLICY "job_alerts_insert_own"
  ON public.job_alerts FOR INSERT
  WITH CHECK (auth.uid() = seeker_id);
CREATE POLICY "job_alerts_update_own"
  ON public.job_alerts FOR UPDATE
  USING (auth.uid() = seeker_id);
CREATE POLICY "job_alerts_delete_own"
  ON public.job_alerts FOR DELETE
  USING (auth.uid() = seeker_id);

DROP POLICY IF EXISTS "cv_settings_select_own" ON public.cv_settings;
DROP POLICY IF EXISTS "cv_settings_insert_own" ON public.cv_settings;
DROP POLICY IF EXISTS "cv_settings_update_own" ON public.cv_settings;

CREATE POLICY "cv_settings_select_own"
  ON public.cv_settings FOR SELECT
  USING (auth.uid() = seeker_id);
CREATE POLICY "cv_settings_insert_own"
  ON public.cv_settings FOR INSERT
  WITH CHECK (auth.uid() = seeker_id);
CREATE POLICY "cv_settings_update_own"
  ON public.cv_settings FOR UPDATE
  USING (auth.uid() = seeker_id);

DROP POLICY IF EXISTS "cv_files_select_own" ON public.cv_files;
DROP POLICY IF EXISTS "cv_files_insert_own" ON public.cv_files;
DROP POLICY IF EXISTS "cv_files_update_own" ON public.cv_files;
DROP POLICY IF EXISTS "cv_files_delete_own" ON public.cv_files;

CREATE POLICY "cv_files_select_own"
  ON public.cv_files FOR SELECT
  USING (auth.uid() = seeker_id);
CREATE POLICY "cv_files_insert_own"
  ON public.cv_files FOR INSERT
  WITH CHECK (auth.uid() = seeker_id);
CREATE POLICY "cv_files_update_own"
  ON public.cv_files FOR UPDATE
  USING (auth.uid() = seeker_id);
CREATE POLICY "cv_files_delete_own"
  ON public.cv_files FOR DELETE
  USING (auth.uid() = seeker_id);

DROP POLICY IF EXISTS "referrals_select_own" ON public.referrals;
DROP POLICY IF EXISTS "referrals_insert_own" ON public.referrals;
DROP POLICY IF EXISTS "referrals_update_own" ON public.referrals;

CREATE POLICY "referrals_select_own"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);
CREATE POLICY "referrals_insert_own"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);
CREATE POLICY "referrals_update_own"
  ON public.referrals FOR UPDATE
  USING (auth.uid() = referrer_id);

CREATE INDEX IF NOT EXISTS idx_job_alerts_seeker_id ON public.job_alerts (seeker_id);
CREATE INDEX IF NOT EXISTS idx_cv_files_seeker_id ON public.cv_files (seeker_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals (referrer_id);
