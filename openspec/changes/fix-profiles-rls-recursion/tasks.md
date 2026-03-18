## 1. Canonicalize profiles RLS policy state

- [x] 1.1 Audit existing `public.profiles` policy/function migrations and identify canonical recursion-safe end-state for all environments
- [x] 1.2 Add or refine migration SQL so policy/function creation is idempotent and converges to one authoritative `profiles` SELECT access model
- [x] 1.3 Ensure required grants/ownership/search-path assumptions for helper function(s) are explicit and stable

## 2. Validate authorization behavior and recursion safety

- [x] 2.1 Add a verification checklist (SQL introspection + runtime checks) for self-read, employer-applicant-read, and denied unrelated access
- [ ] 2.2 Execute migration + verification flow on a clean/dev environment and confirm no `42P17` in profile-read paths
- [ ] 2.3 Re-run migration on an already-updated environment to confirm idempotent convergence and no duplicate/conflicting policy objects

## 3. Regression hardening and rollout readiness

- [ ] 3.1 Validate profile-dependent app/edge paths (auth profile and employer applicant flows) against the converged DB state
- [x] 3.2 Capture rollback and operational runbook notes for policy regression scenarios
- [ ] 3.3 Update change artifacts/test evidence and mark verification complete for implementation handoff

## Notes

- Environment execution blocker: Supabase CLI is not installed in this workspace environment, so DB migration execution/verification steps (2.2, 2.3, and DB-dependent part of 3.1) remain pending.
