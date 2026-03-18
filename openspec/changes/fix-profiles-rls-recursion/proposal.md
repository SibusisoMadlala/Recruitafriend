## Why

Authenticated flows intermittently fail with PostgreSQL error `42P17` (`infinite recursion detected in policy for relation "profiles"`) when reading `public.profiles`. This blocks employer applicant review and degrades profile-dependent experiences, so we need a durable policy design that removes recursion risk and restores predictable access behavior.

## What Changes

- Stabilize `public.profiles` SELECT authorization for self-access and employer applicant visibility without recursive RLS evaluation.
- Align migration history so the final, non-recursive policy state is deterministic across environments.
- Define clear verification criteria for policy behavior and regression checks for profile reads used by auth and employer applicant workflows.
- Standardize failure handling expectations so policy errors are surfaced as actionable operational failures rather than silent degradation.

## Capabilities

### New Capabilities
- `profiles-policy-safety`: Defines non-recursive `profiles` read authorization semantics, migration-state guarantees, and verification criteria for profile access workflows.

### Modified Capabilities
- _(none)_

## Impact

- `supabase/migrations/*` policy and helper-function migration chain affecting `public.profiles` access control.
- Profile-dependent API/query paths used by auth profile reads and employer applicant views.
- OpenSpec artifacts for the new capability under `openspec/changes/fix-profiles-rls-recursion/specs/` and `openspec/specs/` alignment for future changes.
