# Admin Employer Onboarding Rollout / Rollback Runbook

## Scope

This runbook covers rollout and rollback for:
- Employer lifecycle state gating (`employer_status`)
- Employer onboarding submission and remediation APIs
- Admin onboarding review queue and decision actions
- Admin/onboarding UI routes and protected-route enforcement

## Rollout Steps

1. **Prepare database migration**
   - Apply migration: `20260323120000_admin_employer_onboarding_foundation.sql`
   - Verify creation of:
     - `employer_onboarding_submissions`
     - `employer_onboarding_documents`
     - `admin_onboarding_audit_log`
   - Verify `profiles` includes lifecycle fields and `admin` user_type support.

2. **Seed/verify admin operators**
   - Ensure designated admin users have `profiles.user_type = 'admin'`.
   - Verify admin users can access `/admin/dashboard` and `/admin/onboarding`.

3. **Deploy server function**
   - Deploy updated `supabase/functions/server/index.tsx`.
   - Verify endpoints:
     - `POST /employer/onboarding/submissions`
     - `GET /employer/onboarding/status`
     - `GET /admin/onboarding/queue`
     - `GET /admin/onboarding/queue/:employerId`
     - `POST /admin/onboarding/:employerId/decision`

4. **Deploy frontend**
   - Deploy route/guard updates and pages:
     - `/employer/onboarding-status`
     - `/admin/dashboard`
     - `/admin/onboarding`
   - Verify non-approved employers are redirected away from `/employer/*` operational routes.

5. **Post-deploy checks**
   - Create a new employer account and confirm status defaults to `pending_review`.
   - Submit onboarding details and verify admin queue visibility.
   - Approve from admin queue and confirm immediate access to `/employer/dashboard`.
   - Reject/request-info and confirm remediation messaging appears on status page.

## Feature Guard / Fallback Controls

- **Primary guard:** `ProtectedRoute requireApprovedEmployer`
- **Server guard:** `requireApprovedEmployer` helper in edge function
- **Admin guard:** `requireAdmin` helper

If production issues occur, fallback can be done by temporarily bypassing the frontend employer-status guard while keeping server-side authorization intact.

## Rollback Strategy

1. **Frontend rollback (fastest)**
   - Revert route guard changes for employer routes if access outage occurs.
   - Keep onboarding status route available for data continuity.

2. **Server rollback**
   - Revert edge function to pre-onboarding version.
   - Keep migration data in place (non-destructive) to preserve auditability.

3. **Policy rollback (surgical)**
   - If needed, temporarily relax employer gating by adjusting helper checks in server code.
   - Do **not** drop onboarding/audit tables during incident mitigation.

4. **Data safety**
   - Onboarding submissions and audit events are immutable records for compliance and should remain intact.

## Incident Checklist

- Capture failing endpoint and status code.
- Confirm caller profile role + `employer_status`.
- Confirm admin decisions are writing audit entries.
- Confirm SMTP config for notification dispatch if decision emails fail.

## Success Criteria

- Approved employers can access all employer operations.
- Non-approved employers receive status-specific denial guidance.
- Admins can review queue, inspect docs metadata, and apply lifecycle decisions.
- Every decision creates an audit event.
