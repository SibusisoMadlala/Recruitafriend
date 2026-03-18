## ADDED Requirements

### Requirement: Supabase Postgres tables replace the KV store
The system SHALL define and apply a Supabase migration that creates `profiles`, `jobs`, `applications`, and `saved_jobs` tables. The Edge Function SHALL use the Supabase service-role client to query these tables instead of `kv_store.tsx`.

#### Scenario: Migration runs successfully
- **WHEN** `supabase db push` is executed against a fresh schema
- **THEN** all four tables are created without errors

#### Scenario: Edge Function reads from Postgres
- **WHEN** `GET /jobs` is called after migration
- **THEN** the handler queries `SELECT * FROM jobs WHERE status = 'active'` and returns results from Postgres

### Requirement: Row Level Security is enabled on all tables
The system SHALL enable RLS on `profiles`, `jobs`, `applications`, and `saved_jobs`. Access SHALL be denied by default and opened only by explicit policies.

#### Scenario: Anonymous user cannot read profiles
- **WHEN** an unauthenticated request queries the `profiles` table directly
- **THEN** Supabase returns an empty result set (RLS denies the read)

#### Scenario: Seeker can read only their own profile
- **WHEN** an authenticated seeker queries `profiles` where `id = auth.uid()`
- **THEN** the system returns that seeker's row and no other rows

#### Scenario: Jobs are publicly readable when active
- **WHEN** any user (authenticated or not) queries `jobs` where `status = 'active'`
- **THEN** the system returns matching job rows

#### Scenario: Employer can only update their own jobs
- **WHEN** an authenticated employer attempts to UPDATE a job where `employer_id != auth.uid()`
- **THEN** the update is rejected by RLS with a "permission denied" error

### Requirement: A profile row is created automatically on user sign-up
A Postgres trigger on `auth.users` INSERT SHALL create a corresponding row in `profiles` using `user_metadata` for `name` and `user_type`, so the Edge Function signup handler no longer needs to call `kv.set`.

#### Scenario: New user triggers profile creation
- **WHEN** a new user is created in `auth.users`
- **THEN** a matching row appears in `profiles` within the same transaction

### Requirement: The `kv_store.tsx` file is removed
The `supabase/functions/server/kv_store.tsx` file and all its imports in `index.tsx` SHALL be deleted once all routes are migrated to Postgres queries.

#### Scenario: Build succeeds without kv_store
- **WHEN** `kv_store.tsx` is deleted and `index.tsx` no longer imports it
- **THEN** the Edge Function deploys without TypeScript or runtime errors

### Requirement: JobSearch API supports pagination
The `GET /jobs` endpoint SHALL accept optional `page` (default 1) and `limit` (default 20, max 100) query parameters and return a `totalCount` field alongside `jobs`.

#### Scenario: Paginated request returns correct slice
- **WHEN** `GET /jobs?page=2&limit=10` is called and 25 active jobs exist
- **THEN** the response contains jobs 11–20 and `totalCount: 25`

#### Scenario: Default pagination applies when params are absent
- **WHEN** `GET /jobs` is called with no pagination params
- **THEN** the response returns up to 20 jobs starting from page 1
