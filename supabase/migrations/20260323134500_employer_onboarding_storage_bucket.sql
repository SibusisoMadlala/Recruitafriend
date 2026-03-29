-- ============================================================
-- Employer onboarding storage bucket + policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employer-onboarding',
  'employer-onboarding',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "employer_onboarding_upload_own" ON storage.objects;
CREATE POLICY "employer_onboarding_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'employer-onboarding'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "employer_onboarding_read_own_or_admin" ON storage.objects;
CREATE POLICY "employer_onboarding_read_own_or_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employer-onboarding'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_profile(auth.uid())
    )
  );

DROP POLICY IF EXISTS "employer_onboarding_update_own" ON storage.objects;
CREATE POLICY "employer_onboarding_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'employer-onboarding'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'employer-onboarding'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "employer_onboarding_delete_own" ON storage.objects;
CREATE POLICY "employer_onboarding_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'employer-onboarding'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_profile(auth.uid())
    )
  );