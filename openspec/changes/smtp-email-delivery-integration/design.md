## Context

The current application already captures email-facing user intent in several workflows (job alerts, referrals, interview-related communications, team invites, and email templates in employer settings), but product email dispatch is not consistently implemented end-to-end. The backend edge function (`supabase/functions/server/index.tsx`) is the central place where these workflows are orchestrated and authorized today.

The team has decided to use Supabase SMTP configuration as the transport path. This introduces a clear split:
- Supabase Auth-managed emails (password reset, magic links, account verification) remain handled by Supabase Auth.
- Product workflow emails are orchestrated by the application backend and sent via SMTP transport.

Constraints:
- Keep change additive and compatible with current API shape.
- Avoid broad architecture rewrite in this phase.
- Preserve a future path to split email logic from `index.tsx` if complexity grows.

## Goals / Non-Goals

**Goals:**
- Add a shared product email dispatch path in `supabase/functions/server/index.tsx`.
- Ensure all in-app flows that require email sending route through a consistent orchestration pipeline.
- Enforce notification preference checks and safe template variable rendering before send.
- Add delivery observability (attempts, status, error details, correlation ids) for operational debugging.
- Support deterministic retries and idempotency for transient failures.

**Non-Goals:**
- Replacing Supabase Auth email handling with custom auth email logic.
- Building a full marketing-campaign platform.
- Implementing complex workflow orchestration across multiple services in this phase.
- Refactoring all route handlers into separate files immediately.

## Decisions

### 1) Keep product email orchestration in `index.tsx` initially

**Decision:** Introduce email orchestration functions and route-triggered send calls inside `supabase/functions/server/index.tsx`, with clear internal boundaries (route layer, orchestration layer, transport layer, logging layer).

**Why:** This matches existing backend architecture and accelerates integration without introducing a new deployment unit.

**Alternatives considered:**
- Separate dedicated edge function for email only: rejected for now due to additional operational overhead and current project scale.
- External workflow engine first: rejected as premature complexity.

### 2) Use Supabase SMTP configuration as transport source of truth

**Decision:** Product workflow sends use SMTP credentials/config managed in Supabase environment.

**Why:** Aligns with the team’s platform decision and reduces provider lock-in at code level.

**Alternatives considered:**
- Provider-specific API integration (e.g., direct HTTP send APIs): rejected for now to keep transport abstraction simple.

### 3) Introduce an additive email event + delivery log model

**Decision:** Persist outbound send intent and delivery outcomes in additive storage (log table(s) or equivalent) with fields for event type, recipient, template key, payload snapshot/hash, attempt count, status, and error metadata.

**Why:** Required for debugging, auditing, retries, and preventing duplicate sends.

**Alternatives considered:**
- Fire-and-forget sends with only console logs: rejected due to low reliability and poor traceability.

### 4) Enforce idempotency and retry semantics at orchestration boundary

**Decision:** Email sends use idempotency keys per business event (e.g., alert-id + scheduled window, referral-id + action) and bounded retry policy for transient SMTP failures.

**Why:** Prevent duplicate user emails and improve reliability under network/provider instability.

**Alternatives considered:**
- No idempotency: rejected due to duplicate-send risk on retries and retried HTTP requests.

### 5) Explicitly separate auth email vs product email responsibilities

**Decision:** Keep Supabase Auth emails untouched; only workflow-triggered product emails are in scope for this change.

**Why:** Avoids conflating security/auth lifecycle with product notification lifecycle and reduces regression risk.

**Alternatives considered:**
- Unify all email under one custom pipeline now: rejected as out-of-scope and high-risk.

## Risks / Trade-offs

- **[Risk] `index.tsx` growth and maintainability pressure** → **Mitigation:** define internal function boundaries now and schedule extraction to modules once stable.
- **[Risk] Deliverability issues despite successful SMTP handoff** → **Mitigation:** require SPF/DKIM/DMARC setup, monitor bounce/complaint signals where available.
- **[Risk] Duplicate emails from retries/replayed requests** → **Mitigation:** idempotency keys + delivery state checks.
- **[Risk] Template variable mismatch causing broken content** → **Mitigation:** pre-send template variable validation with fail-fast errors.
- **[Risk] Preference drift (emails sent despite opt-outs)** → **Mitigation:** centralized preference gate in orchestration layer, not per-route ad hoc logic.

## Migration Plan

1. Define and deploy additive storage for email delivery state/logging.
2. Add internal email orchestration + transport adapter functions to `index.tsx`.
3. Integrate one low-risk workflow first (referral invite or alert email) and validate observability.
4. Roll out remaining email-required workflows incrementally.
5. Add integration tests for successful send, preference-blocked send, retry path, and idempotency behavior.
6. Validate production readiness checklist (SMTP secrets, sender identity, SPF/DKIM/DMARC, alerting).

Rollback strategy:
- Keep new code paths behind additive checks and disable new sends by feature flag/config if needed.
- Revert route-level email trigger wiring while retaining non-breaking schema additions.

## Open Questions

- Which exact workflows are mandatory in phase 1 vs phase 2 for “all processes that require email sending”?
- Should weekly/daily seeker alert emails be sent synchronously on request triggers or through scheduled batch dispatch?
- Do we need user-visible delivery history (UI), or is backend observability sufficient for this phase?
- What retry policy limits are acceptable (attempt count/backoff) before terminal failure?
- Which sender identities/domains are approved per email category (transactional vs product updates)?