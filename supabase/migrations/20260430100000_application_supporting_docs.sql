-- ============================================================
-- Application Supporting Documents
-- Seekers can upload supporting documents per application.
-- Employers can view/download them through a server-side signed URL.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.application_supporting_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  seeker_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_size     BIGINT,
  mime_type     TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'application-docs',
  storage_path  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_supporting_docs_application
  ON public.application_supporting_docs(application_id);

CREATE INDEX IF NOT EXISTS idx_app_supporting_docs_seeker
  ON public.application_supporting_docs(seeker_id);

-- RLS: seekers manage their own docs; employers access via server (service role)
ALTER TABLE public.application_supporting_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_docs_seeker_select_own" ON public.application_supporting_docs;
CREATE POLICY "app_docs_seeker_select_own"
  ON public.application_supporting_docs FOR SELECT
  TO authenticated
  USING (seeker_id = auth.uid());

DROP POLICY IF EXISTS "app_docs_seeker_insert_own" ON public.application_supporting_docs;
CREATE POLICY "app_docs_seeker_insert_own"
  ON public.application_supporting_docs FOR INSERT
  TO authenticated
  WITH CHECK (seeker_id = auth.uid());

DROP POLICY IF EXISTS "app_docs_seeker_delete_own" ON public.application_supporting_docs;
CREATE POLICY "app_docs_seeker_delete_own"
  ON public.application_supporting_docs FOR DELETE
  TO authenticated
  USING (seeker_id = auth.uid());

-- Storage bucket for application supporting documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-docs',
  'application-docs',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: seekers upload and manage files under their own folder
DROP POLICY IF EXISTS "app_docs_upload_own" ON storage.objects;
CREATE POLICY "app_docs_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'application-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "app_docs_read_own" ON storage.objects;
CREATE POLICY "app_docs_read_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "app_docs_delete_own" ON storage.objects;
CREATE POLICY "app_docs_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'application-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
