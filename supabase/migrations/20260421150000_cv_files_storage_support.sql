-- ============================================================
-- CV files storage support (seeker uploads + employer signed access)
-- ============================================================

ALTER TABLE public.cv_files
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'seeker-cvs',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seeker-cvs',
  'seeker-cvs',
  false,
  5242880,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "seeker_cvs_upload_own" ON storage.objects;
CREATE POLICY "seeker_cvs_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seeker-cvs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "seeker_cvs_read_own" ON storage.objects;
CREATE POLICY "seeker_cvs_read_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'seeker-cvs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "seeker_cvs_update_own" ON storage.objects;
CREATE POLICY "seeker_cvs_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'seeker-cvs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'seeker-cvs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "seeker_cvs_delete_own" ON storage.objects;
CREATE POLICY "seeker_cvs_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'seeker-cvs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
