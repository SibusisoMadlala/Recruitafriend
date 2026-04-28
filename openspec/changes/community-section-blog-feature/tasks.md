## 1. Data model and authorization foundation

- [x] 1.1 Create a Supabase migration for `community_blog_posts` with required fields (title, slug, body/content, status, published_at, author metadata, timestamps) and supporting indexes
- [x] 1.2 Add and validate RLS policies so public users can read only published posts and authorized admins can manage all post states
- [x] 1.3 Add migration rollback notes and verification queries for draft-visibility and publish-state safety checks

## 2. Backend service integration

- [x] 2.1 Implement typed blog data access functions for list/detail queries with public visibility filters (`status='published'` and publication timing)
- [x] 2.2 Implement admin blog CRUD and publish/unpublish service functions with input validation and normalized error handling
- [x] 2.3 Add unit/integration coverage for service-level validation and authorization-sensitive query behavior

## 3. Community blog reader experience

- [x] 3.1 Add community blog list view with deterministic loading, empty, and error states
- [x] 3.2 Add community blog detail view route/page with published-post rendering and safe handling for inaccessible content
- [x] 3.3 Add lightweight discovery UX (latest/featured presentation) aligned with existing community layout patterns

## 4. Admin authoring and publishing workflows

- [x] 4.1 Add admin blog management screen for create/edit/delete and draft/published status visibility
- [x] 4.2 Add publish and unpublish actions with optimistic-safe UI feedback and failure recovery states
- [x] 4.3 Enforce client-side field validation for required inputs before submit while preserving server-side validation authority

## 5. Verification and rollout readiness

- [x] 5.1 Run end-to-end smoke checks: admin draft lifecycle, publish visibility, and public draft access denial
- [x] 5.2 Validate route protection and role gating for admin workflows across authenticated and unauthenticated sessions
- [x] 5.3 Document implementation notes and any deferred enhancements (e.g., full media upload pipeline) for follow-up changes
