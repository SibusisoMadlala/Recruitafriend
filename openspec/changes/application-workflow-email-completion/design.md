## Context

Application workflow notifications are currently asymmetric: stage-change notifications are implemented, but submission-time notifications are missing. The backend already has a centralized SMTP dispatch path (`dispatchProductEmail`) with idempotency and logging through `email_delivery_logs`, so this change should extend that existing orchestration rather than introduce a second notification pipeline.

Constraints and considerations:
- Preserve successful business operations even when email delivery fails (non-blocking email side effects).
- Maintain deduplication and deterministic idempotency keys for retriable requests.
- Keep compatibility with existing template rendering and delivery logging behavior.
- Ensure both seeker and employer recipients are resolvable even when profile email fields are incomplete.

## Goals / Non-Goals

**Goals:**
- Add deterministic submit-time application notifications for both employer and seeker.
- Standardize lifecycle event naming and template contracts for application workflow emails.
- Define delivery-state response conventions so API consumers can observe email outcome without coupling business success to SMTP success.
- Add testable requirements for idempotency, failure handling, and fallback recipient resolution.

**Non-Goals:**
- Replacing Supabase Auth-owned auth email flows.
- Building a generalized notification center or campaign engine.
- Refactoring all email logic out of `index.tsx` in this iteration.

## Decisions

### 1) Use dual notification events at application submit
**Decision:** On application creation, emit two distinct email events: employer notice and seeker receipt.

**Why:** Distinct recipients and message intent require separate template contracts and event keys.

**Alternatives considered:**
- Single multi-recipient event: rejected due to weak traceability and template divergence.
- Frontend-triggered second email call: rejected due to reliability and replay complexity.

### 2) Keep email send as non-blocking side-effect of workflow success
**Decision:** Application creation/status updates remain successful even if SMTP dispatch fails; failures are logged and surfaced as delivery metadata.

**Why:** Business state changes must not be rolled back because of transient transport issues.

**Alternatives considered:**
- Hard-fail API on email error: rejected as operationally fragile.

### 3) Enforce idempotent event keys based on business identifiers
**Decision:** Submission notifications use stable event keys derived from application id + audience, while stage-transition keys include stage transition identity.

**Why:** Prevent duplicate email sends during retries/replayed requests while still allowing valid distinct lifecycle events.

**Alternatives considered:**
- Timestamp-only keys: rejected because retries produce duplicates.

### 4) Standardize recipient fallback resolution
**Decision:** Recipient lookup first uses profile email, then auth user email lookup when needed, with skip+log when no valid address exists.

**Why:** Existing data can be incomplete; fallback avoids silent non-delivery for otherwise valid workflows.

**Alternatives considered:**
- Require profile email strictly: rejected due to avoidable delivery loss.

## Risks / Trade-offs

- **[Risk] Duplicate dispatch from accidental key drift** → **Mitigation:** define event-key schema in one place and test replay behavior.
- **[Risk] Missing or invalid emails reduce delivery rate** → **Mitigation:** profile→auth fallback + warning logs + explicit response flags.
- **[Risk] Template variable mismatches break sends** → **Mitigation:** retain required-variable validation and add coverage for application templates.
- **[Risk] Route-level complexity growth in `index.tsx`** → **Mitigation:** keep helper boundaries clear and defer extraction as a follow-up refactor.

## Migration Plan

1. Add/confirm application email specs and task plan.
2. Implement submit-time dual notification dispatch in application create route.
3. Align stage-transition and withdrawal notification behavior with new capability definitions.
4. Add tests for success, failure, replay/idempotency, and recipient fallback.
5. Deploy and monitor `email_delivery_logs` for new application event types.

Rollback strategy:
- Disable new submit-time dispatch calls while retaining additive specs/tests.
- Keep existing stage-change notifications unaffected.

## Open Questions

- Should employer submission notifications include screening answer summaries in v1 or only a concise overview?
- Should seeker withdrawal trigger an explicit seeker confirmation email in addition to employer notice?
- Do we want a dedicated email preference toggle for application notifications separate from broader employer communications?
