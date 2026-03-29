## Why

Employer signup currently creates immediately active employer accounts and grants direct access to employer workflows. This makes trust and marketplace quality management difficult because company identity and submitted business documents are not reviewed before employers can post jobs and operate on the platform.

## What Changes

- Introduce an admin panel with a dashboard and operational statistics focused on onboarding, approvals, and employer quality control.
- Replace direct employer registration with an employer onboarding submission flow that captures company profile and required verification documents.
- Add an employer lifecycle state model (`pending_review`, `needs_info`, `approved`, `rejected`, `suspended`) that determines platform access.
- Gate employer dashboard and employer API actions until onboarding status is approved.
- Add admin review workflows to approve, reject, request additional information, and record reviewer notes.
- Add notification triggers for onboarding state changes (submission received, info requested, approved, rejected).

## Capabilities

### New Capabilities
- `admin-employer-onboarding-workflows`: Admin review queue, decision actions, reviewer notes, and onboarding decision auditability.
- `admin-operations-dashboard`: Admin statistics and operational insights for onboarding throughput, backlog health, and employer lifecycle metrics.
- `employer-onboarding-submission`: Employer onboarding forms, document submission requirements, and submission tracking behavior.
- `employer-access-approval-gating`: Authorization behavior that restricts employer app and API access until onboarding approval.

### Modified Capabilities
- None.

## Impact

- Affected frontend: auth entry flows, employer signup journey, new onboarding status UX, new `/admin/*` routes and admin UI shell.
- Affected backend edge function: onboarding submission endpoints, admin review endpoints, status transitions, and status-aware authorization guards.
- Affected database: new onboarding entities/documents/audit tables and profile status fields plus RLS/policy updates.
- Affected notifications: new email/in-app events for onboarding lifecycle changes.
- Operational impact: requires admin role management and monitoring for onboarding SLA and reviewer throughput.
