## Why

The RecruitFriend codebase has accumulated a set of critical bugs, missing integrations, and architectural gaps that prevent the application from functioning correctly end-to-end. Users can access protected employer/seeker pages without being authenticated, form submissions silently do nothing, navigation links point to non-existent routes, and the backend stores all data in an ephemeral KV store that lacks relational integrity. These issues must be resolved before the platform can be used reliably in production.

## What Changes

- **BREAKING** Replace ephemeral KV-store backend with Supabase database tables (profiles, jobs, applications, saved_jobs) using Row Level Security
- Add protected route wrappers that enforce authentication and redirect unauthenticated users to `/login`
- Add role-based route guards that ensure seekers cannot access employer routes and vice versa
- Fix broken Navbar links (`/seeker/home` → `/seeker/dashboard`, `/seeker/community` → `/community`)
- Fix `CommunityBlogs` — "Back to Home" button must use a router `Link` and navigate to `/`
- Wire up `PostJob` multi-step form: add controlled state for all fields and call `POST /jobs` on final step submission
- Wire up `ProfileBuilder` — convert all inputs to controlled, add Save button that calls `PUT /auth/profile`
- Wire up `EmployerDashboard` — load real stats (active listings, total applications, interviews) from API on mount
- Wire up `SeekerDashboard` — load saved-jobs count and profile-view count from API; fix greeting to be time-of-day-aware
- Implement Forgot Password flow using Supabase `resetPasswordForEmail`
- Extract profile-completion calculation into a shared utility so `SeekerLayout` and `ProfileBuilder` don't duplicate it
- Replace all `any[]` / `any` types in pages and context with proper TypeScript interfaces
- Standardise colour usage to CSS variables (`var(--rf-green)` etc.) and remove all inline `#00C853` / `#0A2540` hardcoded values
- Add a top-level React Error Boundary in `App.tsx`
- Add pagination (page + limit) to `JobSearch` and the `/jobs` API endpoint
- Rename `package.json` `name` field from `@figma/my-make-file` to `recruitfriend-web`

## Capabilities

### New Capabilities

- `route-guards`: Auth + role-based route protection for `/seeker` and `/employer` layouts
- `forgot-password`: Password reset request and confirmation flow
- `post-job-form`: Fully wired multi-step job posting form with API submission and validation
- `profile-save`: Controlled profile builder form with save, field-level validation, and photo upload
- `employer-dashboard-data`: Real-time employer stats loaded from API (listings, applicants, interviews)
- `supabase-db-schema`: Supabase Postgres tables (profiles, jobs, applications, saved_jobs) with RLS replacing the KV store

### Modified Capabilities

<!-- No existing specs found in openspec/specs/ — all capabilities documented above are new. -->

## Impact

- **Frontend**: `AuthContext`, `SeekerLayout`, `EmployerLayout`, `Navbar`, `PostJob`, `ProfileBuilder`, `SeekerDashboard`, `EmployerDashboard`, `CommunityBlogs`, `JobSearch`, `App.tsx`, `supabase.ts`
- **Backend**: `supabase/functions/server/index.tsx` and `kv_store.tsx` — jobs, applications, profiles, saved-jobs, and stats endpoints all migrate to Supabase DB
- **Database**: New Supabase migration adding `profiles`, `jobs`, `applications`, `saved_jobs` tables with RLS policies
- **Dependencies**: No new dependencies required; existing `@supabase/supabase-js` covers all DB + auth needs
- **Breaking**: Any data currently in the KV store will not be migrated; the KV store is replaced wholesale
