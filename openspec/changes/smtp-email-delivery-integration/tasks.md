## 1. SMTP foundation and configuration

- [x] 1.1 Document required Supabase SMTP environment configuration and sender identity prerequisites
- [x] 1.2 Add backend configuration guards that fail fast when SMTP settings are missing or invalid
- [x] 1.3 Define sender identity policy by email category (alerts, referrals, employer communications)

## 2. Shared product email orchestration

- [x] 2.1 Implement internal email orchestration functions in `supabase/functions/server/index.tsx` with route/orchestration/transport boundaries
- [x] 2.2 Implement SMTP transport adapter used by product workflows
- [x] 2.3 Implement template rendering and required-variable validation before dispatch
- [x] 2.4 Add centralized preference checks before sending product emails

## 3. Delivery observability, idempotency, and retry behavior

- [x] 3.1 Add additive persistence for delivery attempts and outcomes (success/failure metadata)
- [x] 3.2 Implement idempotency key handling to prevent duplicate sends for retried events
- [x] 3.3 Implement bounded retry policy for transient SMTP failures with terminal failure recording

## 4. Seeker alerts email dispatch integration

- [x] 4.1 Extend alert create/update flows to persist delivery-related configuration needed for dispatch
- [x] 4.2 Implement alert email dispatch behavior for active daily and weekly alerts
- [x] 4.3 Ensure paused or deleted alerts suppress future dispatch attempts

## 5. Seeker referral email integration

- [x] 5.1 Extend referral invite flow to dispatch email invites when a referee email is provided
- [x] 5.2 Persist and expose referral invite send outcome metadata for activity rendering

## 6. Employer workflow email integration

- [x] 6.1 Implement team invite email dispatch on valid invite actions
- [x] 6.2 Implement interview invitation email dispatch through template-backed payloads
- [x] 6.3 Implement validation and error handling for employer communication template variables

## 7. Validation and regression coverage

- [x] 7.1 Add integration tests for successful email-triggered workflow actions across alerts, referrals, and employer flows
- [ ] 7.2 Add tests for preference-blocked sends, template validation failures, and SMTP failure handling
- [ ] 7.3 Add tests for idempotency and retry behavior to prevent duplicate user emails
- [ ] 7.4 Run build and test suite; verify no regressions in existing seeker workflow capabilities