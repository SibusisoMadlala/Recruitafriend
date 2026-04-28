-- ============================================================
-- Community blog foundation
-- ============================================================

CREATE TABLE IF NOT EXISTS public.community_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_blog_posts_status_published_at
  ON public.community_blog_posts (status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_blog_posts_created_at
  ON public.community_blog_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_blog_posts_featured_published
  ON public.community_blog_posts (featured, published_at DESC)
  WHERE status = 'published';

ALTER TABLE public.community_blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_blog_posts_public_select_published" ON public.community_blog_posts;
CREATE POLICY "community_blog_posts_public_select_published"
  ON public.community_blog_posts FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= now()
  );

DROP POLICY IF EXISTS "community_blog_posts_admin_select_all" ON public.community_blog_posts;
CREATE POLICY "community_blog_posts_admin_select_all"
  ON public.community_blog_posts FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  );

DROP POLICY IF EXISTS "community_blog_posts_admin_insert" ON public.community_blog_posts;
CREATE POLICY "community_blog_posts_admin_insert"
  ON public.community_blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  );

DROP POLICY IF EXISTS "community_blog_posts_admin_update" ON public.community_blog_posts;
CREATE POLICY "community_blog_posts_admin_update"
  ON public.community_blog_posts FOR UPDATE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  );

DROP POLICY IF EXISTS "community_blog_posts_admin_delete" ON public.community_blog_posts;
CREATE POLICY "community_blog_posts_admin_delete"
  ON public.community_blog_posts FOR DELETE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR public.is_admin_profile(auth.uid())
  );

-- ------------------------------------------------------------
-- Verification queries (post-deploy smoke checks)
-- ------------------------------------------------------------
-- 1) Confirm table + indexes:
-- SELECT to_regclass('public.community_blog_posts') AS blog_table;
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'community_blog_posts';
--
-- 2) Confirm policy coverage:
-- SELECT policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'community_blog_posts'
-- ORDER BY policyname;
--
-- 3) Confirm no draft leakage for anonymous/public role:
-- (Run as anon/authenticated non-admin in a test session)
-- SELECT id, status, published_at FROM public.community_blog_posts WHERE status = 'draft';
-- Expected: 0 rows.
--
-- 4) Confirm published visibility:
-- INSERT one row as admin with status='published' and published_at <= now();
-- SELECT id, slug, status FROM public.community_blog_posts;
-- Expected: published row visible.

-- ------------------------------------------------------------
-- Rollback guidance
-- ------------------------------------------------------------
-- If rollback is required, execute in order:
-- DROP TABLE IF EXISTS public.community_blog_posts;
-- This removes dependent indexes and policies.
-- Note: rollback deletes blog content; export required rows before rollback if preservation is needed.
