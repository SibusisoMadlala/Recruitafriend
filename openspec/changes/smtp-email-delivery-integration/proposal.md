## Why

The application currently has multiple email-related user workflows and templates, but outbound product email delivery is not consistently implemented across those flows. We need a unified SMTP-backed delivery approach now to make user-facing email actions reliable, auditable, and production-ready.

## What Changes

- Introduce a centralized email delivery layer in the edge server (`supabase/functions/server/index.tsx`) for product workflow emails.
- Configure and use Supabase SMTP settings for application email transport.
- Add standardized email send behavior for all in-app workflows that require email delivery (alerts, referral invites, interview invites, application communication, and team invites).
- Add email delivery logging and failure reporting to make send outcomes observable.
- Enforce notification preferences and template variable rendering safety before dispatch.

## Capabilities

### New Capabilities
- `platform-email-delivery`: Shared SMTP-backed email orchestration, transport, retry/error handling, and delivery logging for product workflows.
- `employer-email-workflows`: Employer-driven email actions (team invites, interview invites, application communication templates) routed through the shared delivery layer.

### Modified Capabilities
- `seeker-alerts-workflows`: Extend alert workflows to include real email dispatch for active alerts based on configured frequency.
- `seeker-network-referrals`: Extend referral workflows to dispatch referral invite emails when a referee email is provided.

## Impact

- Affected backend: `supabase/functions/server/index.tsx` (new email orchestration + send handlers), and any helper modules introduced for transport/templates/logging.
- Affected frontend: existing settings and workflow pages that trigger email-required actions (especially employer settings, alerts, networking/referrals).
- Affected data model: likely additive tables/fields for email logs, queue/state, and template rendering metadata.
- Affected operations: Supabase SMTP configuration, sender domain verification (SPF/DKIM/DMARC), and environment secret management.
- Testing impact: integration tests for email-triggering workflows, preference enforcement, and error-path behavior.