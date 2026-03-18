## Context

RecruitFriend is a React 18 / Vite SPA backed by Supabase Auth + a Supabase Edge Function (Hono server). The current architecture stores all application data (profiles, jobs, applications, saved jobs) in a Deno KV store inside the Edge Function. This store is ephemeral, lacks query capability, and provides no relational integrity or access control. The frontend has several pages where form state is never wired to API calls (PostJob, ProfileBuilder), route protection is absent or incomplete, and several navigation links point to routes that do not exist. The result is a codebase that renders but does not function.

## Goals / Non-Goals

**Goals:**
- Replace the KV store with Supabase Postgres tables and enforce Row Level Security (RLS) on all tables
- Add a `ProtectedRoute` HOC / wrapper that redirects unauthenticated users to `/login` and enforces role (`seeker` | `employer`) correctness
- Make `PostJob`, `ProfileBuilder` fully interactive — controlled form state → API submission → success/error feedback
- Load real data into `EmployerDashboard` and `SeekerDashboard` from API on mount
- Implement Forgot Password using `supabase.auth.resetPasswordForEmail`
- Fix all broken navigation links and button handlers
- Standardise all colours to CSS design-token variables; eliminate hardcoded hex values
- Deduplicate profile-completion logic into `src/app/lib/profileCompletion.ts`
- Add React Error Boundary at app root
- Add server-side pagination to `GET /jobs` and client-side pagination UI in `JobSearch`

**Non-Goals:**
- Real-time subscriptions (Supabase Realtime) — deferred to a separate change
- Full email templating for password reset — Supabase default template is acceptable for now
- Media storage for profile photos — deferred; placeholder upload button is acceptable
- Migrating existing KV data — no production data exists; KV store can be dropped immediately

## Decisions

### 1. Supabase Postgres over KV store

**Decision**: Replace `kv_store.tsx` with direct Supabase client calls from the Edge Function using the service-role key.

**Rationale**: The Supabase JS client (`@supabase/supabase-js`) is already a dependency. Postgres tables provide indexing, foreign-key integrity, and RLS for security. The KV store was a scaffolding artefact with no path to production scalability.

**Alternatives considered**:
- Keep KV store, add a real-time DB later — rejected because it doubles migration effort and means all data would be lost anyway
- SQLite via D1 — rejected; project is already Supabase-first and Deno KV is not D1

**Table schema** (Postgres / Supabase migration):
```sql
-- profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('seeker','employer')),
  subscription TEXT NOT NULL DEFAULT 'FREE',
  headline TEXT,
  summary TEXT,
  phone TEXT,
  location TEXT,
  avatar_url TEXT,
  skills JSONB DEFAULT '[]',
  experience JSONB DEFAULT '[]',
  education JSONB DEFAULT '[]',
  social_links JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  industry TEXT,
  category TEXT,
  employment_type TEXT,
  work_location TEXT,
  province TEXT,
  city TEXT,
  salary_min INT,
  salary_max INT,
  description TEXT,
  requirements TEXT[],
  benefits TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','draft')),
  views INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- applications table
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  seeker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','viewed','shortlisted','interview','offer','rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, seeker_id)
);

-- saved_jobs table
CREATE TABLE saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seeker_id, job_id)
);
```

**RLS policies**: All tables are owner-read/write by default. Jobs are public-read when `status = 'active'`. Applications are read-only by the seeker who created them and by the employer who owns the job.

### 2. `ProtectedRoute` wrapper component

**Decision**: Create `src/app/components/ProtectedRoute.tsx` that wraps child components, checks `user` and `profile.userType` from `AuthContext`, and redirects accordingly.

```tsx
// Usage in routes.ts
{ path: 'dashboard', element: <ProtectedRoute role="seeker"><SeekerDashboard /></ProtectedRoute> }
```

**Rationale**: Centralises auth logic. Individual pages (`SeekerDashboard`) currently duplicate redirect logic manually with `useEffect` — that duplication should be removed.

**Alternatives considered**:
- Loader functions (React Router v7 `loader`) — viable but requires async context access outside React; adds boilerplate for each route
- Middleware pattern — not natively supported in React Router v7 for client-side SPAs

### 3. Controlled forms with `react-hook-form`

**Decision**: Wire `PostJob` and `ProfileBuilder` using `react-hook-form` (already in `package.json`).

**Rationale**: `react-hook-form` is already installed. Uncontrolled inputs with `defaultValue` don't capture edits; switching to `register()` + `handleSubmit()` is the most ergonomic path using the existing dependency.

**Alternatives considered**:
- Plain `useState` per field — more verbose; `react-hook-form` already provides validation
- Zod schema validation — beneficial but out of scope for this QA pass; can be added later

### 4. Pagination strategy

**Decision**: Server-side pagination using `?page=1&limit=20` query params on `GET /jobs`. Client shows numbered page controls.

**Rationale**: Loading all jobs at once is a scalability issue. Simple page/limit is straightforward to implement and sufficient for current data volumes.

**Alternatives considered**:
- Cursor-based pagination — more robust for large datasets but adds complexity not yet needed
- Infinite scroll — deferred until UX decision is made

### 5. Forgot Password

**Decision**: Use Supabase `resetPasswordForEmail(email, { redirectTo })`.  A new route `/reset-password` handles the deep link from the email and calls `supabase.auth.updateUser({ password })`.

**Rationale**: Zero additional backend code; Supabase handles email delivery and token validation.

## Risks / Trade-offs

- **KV store drop is destructive** → No production data exists yet; risk is acceptable. Any seeded test data must be re-seeded via the new migration.
- **RLS misconfiguration could leak data** → Mitigation: write RLS policies defensively (deny by default), test with both authenticated and anonymous sessions in Supabase dashboard.
- **`react-hook-form` migration may break existing UI styling** → Mitigation: `register()` is transparent to Tailwind classes; existing inputs only need the spread of `register('fieldName')`.
- **Profile photo upload deferred** → The Upload button in `ProfileBuilder` remains a non-functional placeholder. This is an accepted limitation documented in the tasks.
- **Pagination changes the `JobSearch` API contract** → Employers using `/jobs` without pagination params still get all jobs (default `page=1&limit=50`). Forward-compatible.

## Migration Plan

1. Write Supabase DB migration SQL (`supabase/migrations/<timestamp>_init.sql`) and run `supabase db push`
2. Update Edge Function: replace all `kv.*` calls with Supabase client queries
3. Update frontend: `ProtectedRoute` wrapper, fix links, wire forms, load dashboard data, add error boundary
4. Remove `kv_store.tsx` once all routes are validated
5. Deploy Edge Function via `supabase functions deploy server`

**Rollback**: The KV store file can be restored from git; no user data is at risk.

## Open Questions

- Should `profiles` be auto-created via a Supabase DB trigger on `auth.users` insert, or should the signup Edge Function continue creating the profile? (Recommendation: DB trigger — more reliable.)
- Should the `POST /jobs` endpoint validate that the employer has an active subscription before allowing job posting? (Deferred — subscription logic not yet defined.)
