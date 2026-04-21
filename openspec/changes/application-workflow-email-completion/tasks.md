## 1. Application submit notification wiring

- [x] 1.1 Add submit-time employer notification dispatch in `POST /make-server-bca21fd3/applications` using deterministic event keys
- [x] 1.2 Add submit-time seeker receipt notification dispatch in `POST /make-server-bca21fd3/applications` using deterministic event keys
- [x] 1.3 Add concise template payload mapping for applicant, role, company, and submission timestamp variables
- [x] 1.4 Return structured delivery-state metadata for submit workflow without failing successful application creation

## 2. Lifecycle notification hardening

- [x] 2.1 Align stage-transition event key schema and template key usage for consistency across status changes
- [x] 2.2 Ensure interview-stage notifications include scheduling/link metadata fallbacks and variable validation
- [x] 2.3 Add withdrawal-path notification behavior and delivery metadata handling per spec requirements
- [x] 2.4 Centralize recipient fallback resolution (profile email then auth-user email) for application workflow notifications

## 3. Observability and idempotency safeguards

- [x] 3.1 Add/confirm stable idempotency key generation for application-submission audience variants
- [x] 3.2 Ensure duplicate/replayed requests are deduplicated via `email_delivery_logs` event keys
- [x] 3.3 Add explicit skipped-send logging when no valid recipient is resolvable
- [x] 3.4 Verify failure-path behavior keeps workflow actions successful while persisting failed delivery metadata

## 4. Verification and regression coverage

- [x] 4.1 Add integration tests for successful dual-send on application submission (employer + seeker)
- [x] 4.2 Add tests for stage transition/interview notifications with expected template variables
- [x] 4.3 Add tests for missing-recipient fallback and unresolved-recipient skip behavior
- [x] 4.4 Add replay/idempotency tests proving no duplicate emails for same business event
- [x] 4.5 Run targeted and full test suites, then record verification evidence for this change
