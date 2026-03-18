-- Allow employers to read seeker profiles for candidates who applied to their jobs
-- This supports employer applicant views when querying via authenticated client.

DROP POLICY IF EXISTS "profiles_select_employer_applicants" ON public.profiles;

CREATE POLICY "profiles_select_employer_applicants"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.seeker_id = public.profiles.id
        AND j.employer_id = auth.uid()
    )
  );
