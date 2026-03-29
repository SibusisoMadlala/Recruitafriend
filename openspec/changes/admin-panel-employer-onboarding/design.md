## Context

RecruitFriend currently treats employer signup as immediate activation: users choosing employer type can authenticate, route into `/employer/*`, and execute employer actions if `profiles.user_type = 'employer'`. There is no onboarding review checkpoint, no employer approval lifecycle, and no dedicated admin surface for operational oversight.

This change is cross-cutting across frontend auth/navigation, backend edge-function authorization, data model/RLS, and notification workflows. It also introduces a new operations role boundary (admin) and requires auditable status transitions.

## Goals / Non-Goals

**Goals:**
- Introduce an employer onboarding lifecycle that separates account creation from platform activation.
- Add an admin panel with onboarding review tools and operational statistics.
- Enforce employer approval gates consistently in UI routing and backend API authorization.
- Create auditable review decisions and clear onboarding status transitions.
- Preserve seeker workflows and minimize disruption to existing employer data.

**Non-Goals:**
- Rebuild existing employer dashboard feature set.
- Introduce external KYC/fraud vendors in the initial release.
- Redesign all existing authentication UX beyond onboarding-related changes.
- Deliver advanced BI/reporting tooling outside core admin operational stats.

## Decisions

1. **Use explicit onboarding lifecycle states on employer profiles**
   - Decision: Add an `employer_status` state model (`pending_review`, `needs_info`, `approved`, `rejected`, `suspended`) and transition metadata (`reviewed_at`, `reviewed_by`, `live_at`).
   - Rationale: Keeps authorization checks fast and centralized while preserving current role semantics.
   - Alternative considered: infer status from onboarding records only; rejected because it complicates guard logic and increases query overhead for common auth checks.

2. **Split onboarding submission records from profile identity**
   - Decision: Introduce dedicated onboarding entities for submissions and document references rather than overloading `profiles.social_links` JSON.
   - Rationale: Structured review data improves validation, auditability, and queryability.
   - Alternative considered: keep everything in profile JSON; rejected due to weak schema guarantees and poor review analytics.

3. **Enforce approval in three layers**
   - Decision: Apply gating in route guards (`/employer/*`), backend helper checks (`requireApprovedEmployer`), and policy/query constraints for employer-owned operations.
   - Rationale: Defense in depth prevents bypass through direct API calls or stale client assumptions.
   - Alternative considered: frontend-only gate; rejected for security weakness.

4. **Treat admin as privileged operational role with dedicated routes**
   - Decision: Add `/admin/*` routes and server endpoints requiring admin authorization. Admin actions write immutable audit events.
   - Rationale: Isolates operations workflows and enables accountability.
   - Alternative considered: allow employer-superuser approvals; rejected to avoid conflict of interest and privilege escalation risk.

5. **Adopt request-more-info loop without creating new user account states**
   - Decision: Keep user authenticated but constrained to onboarding/status screens when `employer_status != approved`.
   - Rationale: Preserves a smooth onboarding completion path while enforcing business controls.
   - Alternative considered: hard lock sign-in for pending/rejected employers; rejected because it blocks remediation flow and increases support burden.

6. **Provide admin dashboard with operational-first metrics**
   - Decision: Initial metric set includes pending backlog count, aging buckets, approvals/rejections over selectable period, median review time, and active/suspended employer counts.
   - Rationale: These metrics directly support staffing, SLA management, and quality monitoring.
   - Alternative considered: broad product analytics scope; deferred to later phase.

## Risks / Trade-offs

- **[Risk] Authorization drift between frontend and backend checks** → Mitigation: centralize status guard helpers and include scenario-based regression tests for both route and API denial/allow paths.
- **[Risk] Existing employers may be unintentionally blocked after migration** → Mitigation: backfill existing employer rows to `approved` during migration.
- **[Risk] Admin privilege misuse or opaque decisions** → Mitigation: mandatory action reasons for reject/suspend and immutable audit log entries.
- **[Risk] Document handling can introduce data/privacy exposure** → Mitigation: use constrained storage paths, signed access URLs, and explicit retention/deletion policy.
- **[Trade-off] Added operational complexity in auth/profile flows** → Mitigation: keep state model minimal in v1 and defer advanced risk scoring.

## Migration Plan

1. Add schema migration for onboarding/status/audit entities and profile status fields.
2. Backfill existing employer profiles to `approved` with migration timestamp.
3. Add backend helper guards and onboarding/admin endpoints; keep legacy employer endpoints behind new status checks.
4. Introduce frontend onboarding flow and pending-status access constraints.
5. Roll out admin routes and dashboard incrementally (feature-flag or role-gated release).
6. Verify with scenario checks for pending, approved, rejected, and suspended behavior.
7. Rollback strategy: disable new route exposure, revert guard checks, and preserve onboarding records for later replay.

## Open Questions

- What minimum document set is required for first approval (e.g., registration proof, tax document, company domain)?
- Will admin actions support one-step final approval only, or dual-review for high-risk cases?
- Should rejected employers be allowed to create a new onboarding submission, or only amend the previous one?
- Which channels are mandatory for status communications in v1 (email only vs email + in-app notifications)?
