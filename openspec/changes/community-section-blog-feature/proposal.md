## Why

The community section currently lacks a structured publishing channel for long-form updates, announcements, and career guidance content. Adding a blog feature now improves platform engagement, gives admins a managed content surface, and creates a scalable way to deliver value to seekers beyond job listings.

## What Changes

- Add a community blog domain model (posts, author metadata, publish state, and timestamps) backed by Supabase.
- Add read experiences in the community area for blog listing, post detail, and basic discovery (latest/featured).
- Add admin-authoring workflows for creating, editing, publishing, unpublishing, and deleting blog posts.
- Add access controls and visibility rules so only published posts are public while drafts remain restricted.
- Add validation and UX guards for required fields, empty states, and failure handling across create/read/update/delete flows.

## Capabilities

### New Capabilities
- `community-blog-workflows`: End-to-end blog post management and community-facing consumption flows, including publication lifecycle and access control.

### Modified Capabilities
- *(none)*

## Impact

- Affected frontend areas: community section routes/pages/components, shared UI states, and data fetching hooks/services.
- Affected backend/data: new blog-related tables/policies and potential storage support for cover images.
- Affected operations: admin moderation/publishing workflow and content governance expectations.
- Dependencies/systems: Supabase database and RLS policies, existing auth/session context, and current app routing/layout structure.
