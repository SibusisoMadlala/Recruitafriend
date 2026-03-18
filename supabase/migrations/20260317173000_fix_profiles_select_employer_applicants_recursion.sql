-- Fix recursive policy evaluation on public.profiles (42P17)
-- Recreate employer applicant-read policy without table-qualified self-reference.

DROP POLICY IF EXISTS "profiles_select_employer_applicants" ON public.profiles;

CREATE POLICY "profiles_select_employer_applicants"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT a.seeker_id
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE j.employer_id = auth.uid()
    )
  );
