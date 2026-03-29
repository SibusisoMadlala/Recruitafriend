-- ============================================================
-- Admin employer onboarding foundation
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('seeker', 'employer', 'admin'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employer_status TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS live_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_employer_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_employer_status_check
  CHECK (
    employer_status IS NULL
    OR employer_status IN ('pending_review', 'needs_info', 'approved', 'rejected', 'suspended')
  );

UPDATE public.profiles
SET employer_status = 'approved',
    live_at = COALESCE(live_at, now()),
    reviewed_at = COALESCE(reviewed_at, now())
WHERE user_type = 'employer'
  AND COALESCE(employer_status, '') = '';

CREATE TABLE IF NOT EXISTS public.employer_onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  revision_no INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending_review', 'needs_info', 'approved', 'rejected', 'suspended')),
  company_name TEXT NOT NULL,
  registration_number TEXT,
  tax_number TEXT,
  company_website TEXT,
  business_overview TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'South Africa',
  reviewer_notes TEXT,
  remediation_instructions TEXT,
  decision_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employer_id, revision_no)
);

CREATE TABLE IF NOT EXISTS public.employer_onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.employer_onboarding_submissions(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('registration_proof', 'tax_document', 'director_id', 'address_proof', 'bank_letter')),
  storage_bucket TEXT NOT NULL DEFAULT 'employer-onboarding',
  storage_path TEXT NOT NULL,
  original_file_name TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, doc_type)
);

CREATE TABLE IF NOT EXISTS public.admin_onboarding_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  target_employer_id UUID NOT NULL REFERENCES public.profiles(id),
  submission_id UUID REFERENCES public.employer_onboarding_submissions(id),
  action TEXT NOT NULL CHECK (action IN ('submit', 'resubmit', 'approve', 'reject', 'request_info', 'suspend', 'reactivate')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_type_employer_status ON public.profiles (user_type, employer_status);
CREATE INDEX IF NOT EXISTS idx_profiles_reviewed_at ON public.profiles (reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_status_submitted ON public.employer_onboarding_submissions (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_employer_revision ON public.employer_onboarding_submissions (employer_id, revision_no DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_updated ON public.employer_onboarding_submissions (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_submission ON public.employer_onboarding_documents (submission_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_employer ON public.employer_onboarding_documents (employer_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_type_status ON public.employer_onboarding_documents (doc_type, verification_status);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_storage_path ON public.employer_onboarding_documents (storage_bucket, storage_path);

CREATE INDEX IF NOT EXISTS idx_onboarding_audit_target_created ON public.admin_onboarding_audit_log (target_employer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_audit_actor_created ON public.admin_onboarding_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_audit_action_created ON public.admin_onboarding_audit_log (action, created_at DESC);

ALTER TABLE public.employer_onboarding_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_onboarding_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_submissions_select_own_or_admin" ON public.employer_onboarding_submissions;
CREATE POLICY "onboarding_submissions_select_own_or_admin"
  ON public.employer_onboarding_submissions FOR SELECT
  USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type = 'admin'
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "onboarding_submissions_insert_own_or_service" ON public.employer_onboarding_submissions;
CREATE POLICY "onboarding_submissions_insert_own_or_service"
  ON public.employer_onboarding_submissions FOR INSERT
  WITH CHECK (auth.uid() = employer_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "onboarding_submissions_update_own_admin_or_service" ON public.employer_onboarding_submissions;
CREATE POLICY "onboarding_submissions_update_own_admin_or_service"
  ON public.employer_onboarding_submissions FOR UPDATE
  USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "onboarding_docs_select_own_or_admin" ON public.employer_onboarding_documents;
CREATE POLICY "onboarding_docs_select_own_or_admin"
  ON public.employer_onboarding_documents FOR SELECT
  USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "onboarding_docs_insert_own_or_service" ON public.employer_onboarding_documents;
CREATE POLICY "onboarding_docs_insert_own_or_service"
  ON public.employer_onboarding_documents FOR INSERT
  WITH CHECK (auth.uid() = employer_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "onboarding_docs_update_own_admin_or_service" ON public.employer_onboarding_documents;
CREATE POLICY "onboarding_docs_update_own_admin_or_service"
  ON public.employer_onboarding_documents FOR UPDATE
  USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "onboarding_audit_select_admin_or_service" ON public.admin_onboarding_audit_log;
CREATE POLICY "onboarding_audit_select_admin_or_service"
  ON public.admin_onboarding_audit_log FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "onboarding_audit_insert_admin_or_service" ON public.admin_onboarding_audit_log;
CREATE POLICY "onboarding_audit_insert_admin_or_service"
  ON public.admin_onboarding_audit_log FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "profiles_select_admin_all" ON public.profiles;
CREATE POLICY "profiles_select_admin_all"
  ON public.profiles FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "profiles_update_admin_all" ON public.profiles;
CREATE POLICY "profiles_update_admin_all"
  ON public.profiles FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  );
