-- ============================================================
-- Fix admin/profile RLS recursion for onboarding policies
-- ============================================================

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_profile(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = check_user_id
      AND p.user_type = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "onboarding_submissions_select_own_or_admin" ON public.employer_onboarding_submissions;
CREATE POLICY "onboarding_submissions_select_own_or_admin"
  ON public.employer_onboarding_submissions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = employer_id
    OR public.is_admin_profile(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "onboarding_submissions_update_own_admin_or_service" ON public.employer_onboarding_submissions;
CREATE POLICY "onboarding_submissions_update_own_admin_or_service"
  ON public.employer_onboarding_submissions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = employer_id
    OR public.is_admin_profile(auth.uid())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.uid() = employer_id
    OR public.is_admin_profile(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "onboarding_docs_select_own_or_admin" ON public.employer_onboarding_documents;
CREATE POLICY "onboarding_docs_select_own_or_admin"
  ON public.employer_onboarding_documents FOR SELECT
  TO authenticated
  USING (
    auth.uid() = employer_id
    OR public.is_admin_profile(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "onboarding_docs_update_own_admin_or_service" ON public.employer_onboarding_documents;
CREATE POLICY "onboarding_docs_update_own_admin_or_service"
  ON public.employer_onboarding_documents FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = employer_id
    OR public.is_admin_profile(auth.uid())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.uid() = employer_id
    OR public.is_admin_profile(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "onboarding_audit_select_admin_or_service" ON public.admin_onboarding_audit_log;
CREATE POLICY "onboarding_audit_select_admin_or_service"
  ON public.admin_onboarding_audit_log FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  );

DROP POLICY IF EXISTS "onboarding_audit_insert_admin_or_service" ON public.admin_onboarding_audit_log;
CREATE POLICY "onboarding_audit_insert_admin_or_service"
  ON public.admin_onboarding_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  );

DROP POLICY IF EXISTS "profiles_select_admin_all" ON public.profiles;
CREATE POLICY "profiles_select_admin_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  );

DROP POLICY IF EXISTS "profiles_update_admin_all" ON public.profiles;
CREATE POLICY "profiles_update_admin_all"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  );