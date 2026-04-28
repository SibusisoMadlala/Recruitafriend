## Context

Recruitafriend currently supports seeker- and employer-focused workflows, but the community area does not have a formal publishing system for long-form editorial content. The new blog capability spans frontend routing/UI, backend persistence, and authorization controls. The app uses Supabase for database/auth and React + Vite on the client, so the design should align with existing service patterns, route guards, and RLS-first security.

Key constraints:
- Public users should only see published posts.
- Admin workflows must support draft-to-publish lifecycle without exposing drafts.
- Changes should fit current app architecture with minimal disruption to existing seeker workflows.

## Goals / Non-Goals

**Goals:**
- Introduce a robust content model for community blog posts with publication lifecycle support.
- Provide community-facing read flows (list/detail/featured) that are performant and resilient.
- Provide admin CRUD and publish/unpublish flows with clear validation and error handling.
- Enforce least-privilege access via Supabase RLS and role checks.

**Non-Goals:**
- Building a full CMS with rich block-based editing.
- Adding comments, reactions, or moderation tooling in this change.
- Implementing external content syndication (RSS/newsletter automation).

## Decisions

1. **Create a dedicated `community_blog_posts` table with explicit publish metadata.**
   - **Why:** Keeps blog concerns isolated and queryable while enabling lifecycle states (`draft`, `published`, optional `archived`) and publication timestamps.
   - **Alternative considered:** Reusing a generic content table. Rejected due to unclear ownership boundaries and harder policy/query optimization.

2. **Gate visibility by `status='published'` and `published_at <= now()` for public read paths.**
   - **Why:** Prevents premature exposure and supports scheduled publishing if needed.
   - **Alternative considered:** Boolean `is_published` only. Rejected because status-based lifecycle is clearer and more extensible.

3. **Use RLS policies for hard authorization boundaries; keep client guards as UX enhancements only.**
   - **Why:** Security must be enforced server-side regardless of client behavior.
   - **Alternative considered:** Client-only role checks. Rejected as insufficiently secure.

4. **Implement blog data access in dedicated app services/hooks and compose into community routes.**
   - **Why:** Preserves separation of concerns and keeps view components focused on presentation.
   - **Alternative considered:** Inline Supabase queries directly in pages. Rejected due to duplication and testability concerns.

5. **Support optional cover image URL in this phase rather than mandatory storage pipeline.**
   - **Why:** Delivers usable MVP quickly while allowing future extension to managed uploads.
   - **Alternative considered:** Full storage bucket integration now. Deferred to reduce migration and UX complexity in first iteration.

## Risks / Trade-offs

- **[Risk]** Misconfigured RLS could expose draft content → **Mitigation:** Add explicit deny-by-default policies, policy review checklist, and manual verification queries.
- **[Risk]** Admin UX complexity around publish states → **Mitigation:** Keep state model minimal and display explicit status badges/actions.
- **[Risk]** Query performance for community listing as content grows → **Mitigation:** Add indexes on `status`, `published_at`, and `created_at`; paginate list endpoints.
- **[Trade-off]** Deferring full media upload flow may limit editorial flexibility → **Mitigation:** Keep schema forward-compatible for future storage-backed media.

## Migration Plan

1. Add Supabase migration for `community_blog_posts` table, indexes, constraints, timestamps, and status checks.
2. Add RLS policies for public read (published only) and admin write/read all.
3. Add frontend services/hooks for blog list/detail and admin CRUD/publish actions.
4. Add community routes/pages/components for public read flows and admin management screens.
5. Validate with smoke tests (public cannot access drafts; admin can manage lifecycle).
6. Rollback strategy: revert migration, disable routes/feature flags, and remove service wiring in a hotfix if critical issues are found.

## Open Questions

- Should we include scheduled publishing in v1 UI or only immediate publish/unpublish controls?
- Which admin roles (super-admin only vs. content-admin roles) should be permitted to publish/delete?
- Do we want a hard character limit for excerpts/titles to optimize card layouts and SEO snippets?
