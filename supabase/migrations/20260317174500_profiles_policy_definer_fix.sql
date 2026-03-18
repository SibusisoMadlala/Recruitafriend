-- Eliminate recursive RLS evaluation on public.profiles (42P17)
-- by moving employer-applicant visibility logic into a SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.can_employer_view_seeker_profile(seeker_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.applications a ON a.job_id = j.id
    WHERE a.seeker_id = seeker_profile_id
      AND j.employer_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_employer_view_seeker_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_employer_view_seeker_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_employer_applicants" ON public.profiles;

CREATE POLICY "profiles_select_employer_applicants"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.can_employer_view_seeker_profile(id)
  );
