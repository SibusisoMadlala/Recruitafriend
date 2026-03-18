## Profiles Policy Regression Rollback Runbook

### Trigger conditions

Initiate rollback if any of the following occur after deployment:
- `42P17` (`infinite recursion detected in policy for relation "profiles"`) is observed.
- Authorized employer applicant profile reads fail unexpectedly.
- Unauthorized seeker profile reads become possible.

### Immediate containment

1. Pause rollout to additional environments.
2. Capture failing query path, actor type, and exact DB error payload.
3. Export current policy/function definitions for audit:

```sql
select schemaname, tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname='public' and tablename='profiles'
order by policyname;

select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname='can_employer_view_seeker_profile';
```

### Rollback strategy

1. Re-apply the last known-good `profiles` policy/function migration snapshot for the affected environment.
2. Re-run verification checklist items A, B, and D from `artifacts/verification-checklist.md`.
3. Confirm production logs no longer show `42P17`.
4. Document root cause and patch plan before re-attempting rollout.

### Post-incident requirements

- Record incident timeline and impacted user journeys.
- Add or refine migration checks to prevent recurrence.
- Update change evidence (`tasks.md` completion notes / artifacts) with final outcome.
