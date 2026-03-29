## 1. Data model and migration foundations

- [x] 1.1 Add migration to extend `profiles` with employer lifecycle fields (`employer_status`, `reviewed_at`, `reviewed_by`, `live_at`) and backfill existing employers to `approved`
- [x] 1.2 Create onboarding submission table(s) for employer application data with revision support and status linkage
- [x] 1.3 Create onboarding document metadata table and storage path contract for required verification documents
- [x] 1.4 Create immutable admin audit log table for onboarding decisions and sensitive admin actions
- [x] 1.5 Add/adjust indexes and RLS policies to support admin review queries and employer self-read of onboarding status safely

## 2. Backend authorization and onboarding APIs

- [x] 2.1 Add shared server helpers for `requireAdmin` and `requireApprovedEmployer` authorization checks
- [x] 2.2 Update employer-protected API routes to enforce approved status (deny `pending_review`, `needs_info`, `rejected`, `suspended`)
- [x] 2.3 Add employer onboarding submission endpoint(s) with required-field and required-document validation
- [x] 2.4 Add employer onboarding status endpoint for current state, reviewer notes, and remediation instructions
- [x] 2.5 Add admin onboarding queue/list endpoint with status, age, and filtering support
- [x] 2.6 Add admin decision endpoints for approve, reject, request-info, suspend, and reactivate transitions with reason validation
- [x] 2.7 Persist admin audit events for every onboarding decision and lifecycle action

## 3. Notification and status communication workflows

- [x] 3.1 Add onboarding lifecycle notification templates for submission received, needs-info, approved, and rejected outcomes
- [x] 3.2 Trigger notifications from admin decision paths and persist dispatch outcomes
- [x] 3.3 Add employer-facing status messages and guidance payloads for denied employer API responses

## 4. Frontend employer onboarding experience

- [x] 4.1 Replace direct employer signup path with onboarding submission flow and required document inputs
- [x] 4.2 Add employer onboarding status/remediation page for `pending_review`, `needs_info`, `rejected`, and `suspended` states
- [x] 4.3 Update auth/profile bootstrapping to include `employer_status` in session/profile state
- [x] 4.4 Update route guards so `/employer/*` requires employer role plus `approved` status
- [x] 4.5 Ensure approved employers continue to land on `/employer/dashboard` without regression

## 5. Frontend admin panel and dashboard

- [x] 5.1 Add admin route tree and admin layout shell with role-gated navigation
- [x] 5.2 Implement onboarding review queue UI with status filters, aging indicators, and submission summaries
- [x] 5.3 Implement onboarding detail review UI with document metadata visibility and reviewer notes
- [x] 5.4 Implement admin decision actions (approve/reject/request-info/suspend/reactivate) with reason capture and optimistic refresh
- [x] 5.5 Implement admin dashboard KPI cards (pending, needs-info, approvals, rejections, suspended)
- [x] 5.6 Implement trend/latency views for review throughput, backlog growth, and SLA breach highlighting

## 6. Verification and rollout hardening

- [x] 6.1 Add automated tests for onboarding submission validation and remediation loops
- [x] 6.2 Add automated tests for route/API approval gating across all employer lifecycle statuses
- [x] 6.3 Add automated tests for admin queue visibility, decision transitions, and audit log creation
- [ ] 6.4 Run migration verification to confirm legacy employers are backfilled to `approved` and remain functional
- [ ] 6.5 Execute end-to-end smoke tests for employer onboarding, admin review, approval activation, and rejection/remediation paths
- [x] 6.6 Document rollout and rollback runbook with feature flag/guard fallback steps
