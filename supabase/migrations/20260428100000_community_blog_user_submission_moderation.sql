-- ============================================================
-- Community blog user submission + moderation workflow
-- ============================================================

ALTER TABLE public.community_blog_posts
  ADD COLUMN IF NOT EXISTS submitter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

ALTER TABLE public.community_blog_posts
  DROP CONSTRAINT IF EXISTS community_blog_posts_status_check;

ALTER TABLE public.community_blog_posts
  ADD CONSTRAINT community_blog_posts_status_check
  CHECK (status IN ('draft', 'pending_review', 'published', 'rejected'));

UPDATE public.community_blog_posts
SET submitter_id = COALESCE(submitter_id, author_id)
WHERE submitter_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_blog_posts_submitter_status
  ON public.community_blog_posts (submitter_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_blog_posts_pending_review
  ON public.community_blog_posts (status, created_at DESC)
  WHERE status = 'pending_review';

DROP POLICY IF EXISTS "community_blog_posts_author_select_own" ON public.community_blog_posts;
CREATE POLICY "community_blog_posts_author_select_own"
  ON public.community_blog_posts FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND submitter_id = auth.uid()
  );

DROP POLICY IF EXISTS "community_blog_posts_author_insert_pending" ON public.community_blog_posts;
CREATE POLICY "community_blog_posts_author_insert_pending"
  ON public.community_blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND submitter_id = auth.uid()
    AND status = 'pending_review'
    AND published_at IS NULL
  );

DROP POLICY IF EXISTS "community_blog_posts_author_update_own_unpublished" ON public.community_blog_posts;
CREATE POLICY "community_blog_posts_author_update_own_unpublished"
  ON public.community_blog_posts FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND submitter_id = auth.uid()
    AND status IN ('pending_review', 'rejected')
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND submitter_id = auth.uid()
    AND status = 'pending_review'
    AND published_at IS NULL
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );

-- ------------------------------------------------------------
-- Verification checks
-- ------------------------------------------------------------
-- 1) Verify status constraint values:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'community_blog_posts_status_check';
--
-- 2) Verify authenticated user can insert own pending submission:
-- INSERT INTO public.community_blog_posts (slug, title, content, status, submitter_id, author_name)
-- VALUES ('test-slug', 'Test', 'Body', 'pending_review', auth.uid(), 'Test User');
--
-- 3) Verify non-admin cannot set published status directly:
-- UPDATE public.community_blog_posts SET status='published' WHERE submitter_id = auth.uid();
-- Expected: permission denied by RLS/policy check.
--
-- 4) Verify admin can approve/reject by status update and review metadata update.
