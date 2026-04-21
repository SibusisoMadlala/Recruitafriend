-- Allow approved employers to discover seekers in Talent Search when seekers opt into visibility.
-- Keep applicant visibility intact while expanding access to visible seeker profiles.

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_employer_view_visible_seeker_profile(seeker_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles employer_profile
    JOIN public.profiles seeker_profile
      ON seeker_profile.id = seeker_profile_id
    LEFT JOIN public.cv_settings cvs
      ON cvs.seeker_id = seeker_profile.id
    WHERE employer_profile.id = auth.uid()
      AND employer_profile.user_type = 'employer'
      AND COALESCE(employer_profile.employer_status, 'pending_review') = 'approved'
      AND seeker_profile.user_type = 'seeker'
      AND COALESCE(cvs.visibility, true) = true
  );
$$;

REVOKE ALL ON FUNCTION public.can_employer_view_visible_seeker_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_employer_view_visible_seeker_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_employer_applicants" ON public.profiles;

CREATE POLICY "profiles_select_employer_applicants"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.can_employer_view_seeker_profile(id)
    OR public.can_employer_view_visible_seeker_profile(id)
  );
