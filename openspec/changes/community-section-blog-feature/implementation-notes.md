# Community Blog Implementation Notes

## Completed in this change

- Added `community_blog_posts` migration with indexes and RLS policies.
- Added public community blog list/detail data access and admin CRUD/publish/unpublish APIs through app interceptors.
- Added typed service layer for community blog workflows.
- Added community reader UI for listing and detail page.
- Added admin UI for blog post authoring and lifecycle actions.
- Added service-level tests for validation and auth-sensitive operations.

## Verification summary

- Public blog access is constrained to published rows with `published_at <= now()`.
- Admin blog operations enforce authenticated admin role checks.
- Community list/detail pages include loading, empty, and error handling.

## Deferred enhancements

- Rich text/markdown editor and content sanitization pipeline.
- Managed media upload (storage bucket + signed upload flow) for cover assets.
- Scheduled publishing UX (future `published_at`) in admin UI.
- Search/category tags for blog discovery.
