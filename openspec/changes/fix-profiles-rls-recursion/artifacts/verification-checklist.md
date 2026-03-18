## Profiles Policy Safety Verification Checklist

Use this checklist after applying migrations in each target environment.

### A) Migration and object introspection

- [ ] A1. Confirm canonical migration was applied:
  - `supabase/migrations/20260318101500_profiles_policy_canonicalization.sql`
- [ ] A2. Confirm helper function exists and is security definer.
- [ ] A3. Confirm `profiles_select_employer_applicants` policy exists on `public.profiles`.
- [ ] A4. Confirm function execute grant exists for `authenticated` and revoked from `PUBLIC`.

Suggested SQL:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
order by policyname;

select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  pg_get_userbyid(p.proowner) as function_owner,
  p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'can_employer_view_seeker_profile';
```

### B) Runtime authorization behavior

- [ ] B1. As authenticated seeker, query own profile by `id = auth.uid()` and verify success.
- [ ] B2. As authenticated employer, query applicant seeker profile for a seeker who applied to employer-owned job and verify success.
- [ ] B3. As authenticated employer, query unrelated seeker profile and verify no row returned.
- [ ] B4. Verify no `42P17` is returned in any profile-read path.

### C) Idempotency and convergence

- [ ] C1. Re-run migration flow on already-updated DB.
- [ ] C2. Re-run introspection SQL and confirm no duplicate/conflicting policy objects.
- [ ] C3. Re-run runtime checks (B1-B4) and verify behavior unchanged.

### D) App and Edge path checks

- [ ] D1. Auth profile read path returns expected profile payload.
- [ ] D2. Employer job applicants path resolves seeker profile data.
- [ ] D3. Employer seeker-profile endpoint returns authorized profile and denies unrelated seeker.

### Evidence log

- Environment:
- Date/time:
- Operator:
- Result summary:
- Links/screenshots/logs:
