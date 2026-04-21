## Why

Application lifecycle emails are partially implemented, which leaves key hiring moments silent for one or both participants. We need end-to-end workflow notifications so employers and seekers consistently receive transactional updates when applications are submitted and progressed.

## What Changes

- Add explicit dual-notification behavior when a seeker submits an application:
  - employer receives a concise new-application summary
  - seeker receives an application receipt summary
- Standardize application lifecycle notification events and templates across submit, stage transition, interview, rejection, and withdrawal scenarios.
- Define idempotent event keys and delivery observability expectations for application workflow emails to avoid duplicates and improve support diagnostics.
- Add behavioral coverage for failure handling so business actions remain successful while email outcomes are logged and recoverable.

## Capabilities

### New Capabilities
- `application-email-notifications`: Transactional email requirements for application submission and lifecycle events across seeker and employer participants.

### Modified Capabilities
- `seeker-applications-workflows`: Extend workflow requirements so application actions include defined email notification outcomes and delivery-state behavior.

## Impact

- Affected backend: `supabase/functions/server/index.tsx` application routes and email dispatch orchestration paths.
- Affected templates/events: application-related template keys and event naming conventions in delivery logs.
- Affected testing: integration and regression coverage for application submit/status workflows, idempotency, and failure-path behavior.
- Affected operations: monitoring/reporting expectations using `email_delivery_logs` for application workflow events.
