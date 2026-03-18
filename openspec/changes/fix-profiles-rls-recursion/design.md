## Context

`public.profiles` currently has policy evolution across multiple migrations, and environments can drift into a recursive RLS policy state that throws `42P17`. The error appears on authenticated profile reads and employer applicant profile views, creating inconsistent behavior between local/dev/prod depending on applied migration order and current policy objects.

This design needs to ensure the final authorization model is deterministic and recursion-safe while preserving existing intended access:
- users can read their own profile
- employers can read seeker profiles only for seekers who applied to their jobs

## Goals / Non-Goals

**Goals:**
- Guarantee `public.profiles` read authorization does not recursively evaluate `profiles` policies.
- Establish a single canonical migration end-state for the employer-applicant profile policy.
- Define explicit verification checks for policy/function correctness and runtime behavior.
- Keep existing business permissions unchanged while eliminating `42P17` failure mode.

**Non-Goals:**
- Redesigning all RLS policies across unrelated tables.
- Changing product-level profile visibility semantics beyond current intended rules.
- Reworking application UI flows unrelated to profile reads.

## Decisions

### 1) Keep authorization semantics, change implementation shape
Use the same access semantics but enforce them through a recursion-safe policy expression:
- self-read via `auth.uid() = id`
- employer-applicant read via helper logic that does not trigger policy self-reference loops

**Alternatives considered**
- Inline subquery joins directly in `profiles` policy only: simpler SQL but risk-prone when policy clauses evolve and accidentally reintroduce self-reference patterns.
- Broadly allow employer reads by role: rejected for overexposure risk.

### 2) Canonicalize on a single final migration state
Treat the latest non-recursive policy/function state as canonical and ensure all environments converge to it. Migration chain must be idempotent (`DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`) and safe to replay.

**Alternatives considered**
- Rely on manual SQL patching per environment: operationally fragile and difficult to audit.
- Leave multiple equivalent policy variants: increases drift and regression risk.

### 3) Add explicit operational verification gates
Define post-migration checks for:
- policy object presence and expression shape
- function presence/grants (if helper function is used)
- runtime behavior for self-read and employer applicant-read
- absence of `42P17` in tested access paths

**Alternatives considered**
- Verify only via application smoke tests: insufficient to catch drift before runtime.

## Risks / Trade-offs

- [Environment drift between migration history and actual policy objects] → Mitigation: add explicit introspection checks in rollout checklist and require successful checks before release completion.
- [Overly strict policy could block legitimate employer applicant views] → Mitigation: include scenario-level verification for permitted and denied access cases.
- [Hidden dependency on helper function ownership/grants] → Mitigation: define required grants and ownership assumptions in migration validation steps.
- [Temporary fallback logic in app can mask DB regressions] → Mitigation: treat fallback as resilience only; operations must still fail release gate if `42P17` appears.

## Migration Plan

1. Ensure target environments have the canonical recursion-safe policy/function migration applied.
2. Validate policy and helper function objects using SQL introspection checks.
3. Execute runtime validation with authenticated seeker and employer actors.
4. Monitor logs for `42P17` during a controlled verification window.
5. Rollback plan: restore previous known-good policy snapshot if authorization regression occurs, then re-apply corrected canonical migration.

## Open Questions

- Should frontend resilience for `42P17` remain permanently as defense-in-depth, or be reduced after migration convergence is proven?
- Do we want an automated CI check that validates policy/function definitions in a migrated ephemeral DB instance?
- Should employer applicant visibility eventually be codified as a dedicated capability in existing employer-focused specs?
