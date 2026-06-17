-- Add video_answers column to applications
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS video_answers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Create storage bucket for interview videos (private, 100MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'interview-videos',
  'interview-videos',
  false,
  104857600,
  ARRAY['video/webm', 'video/mp4', 'video/quicktime', 'video/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Seekers can upload to their own folder
CREATE POLICY IF NOT EXISTS "Seekers can upload interview videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'interview-videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Seekers can read their own videos
CREATE POLICY IF NOT EXISTS "Seekers can read own interview videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'interview-videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Employers can read all interview videos (needed for applicant review)
CREATE POLICY IF NOT EXISTS "Employers can read interview videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'interview-videos' AND
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'employer'
  )
);
