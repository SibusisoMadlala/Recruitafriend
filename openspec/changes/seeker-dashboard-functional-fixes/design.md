## Context

A targeted QA review of the seeker experience found a large set of UI elements that render as interactive but do not trigger behavior. The review covered:
- Seeker routes and layout navigation (`/seeker/*`)
- Seeker pages (`SeekerDashboard`, `SeekerApplications`, `SeekerSavedJobs`, `SeekerAlerts`, `SeekerCV`, `VideoInterviews`, `Networking`, `SeekerSubscriptions`, `ProfileBuilder`)
- Seeker-facing edge-function endpoints in `supabase/functions/server/index.tsx`
- Build/runtime sanity checks (`vite build` successful, dev server startup successful)

The root pattern is inconsistent integration depth: some screens call real API endpoints while adjacent controls remain placeholders (empty arrays, dead anchors, and buttons without handlers). This change standardizes seeker workflows so all visible primary controls are functional, stateful, and testable.

## Goals / Non-Goals

**Goals:**
- Make all primary seeker dashboard and seeker-page controls functional or intentionally disabled with explicit messaging.
- Connect seeker screens to real backend state and avoid static placeholder arrays as source-of-truth.
- Ensure every seeker workflow has consistent loading/error/empty handling.
- Add regression checks that prevent dead controls from reappearing.

**Non-Goals:**
- Rebranding or major visual redesign of seeker pages.
- New monetization logic beyond wiring existing subscription actions.
- Building full referrals payout/accounting back-office logic in this change.

## Decisions

### 1) Introduce actionability policy for seeker UI controls

**Decision:** Any button/link/toggle presented as actionable on seeker pages MUST either:
1. Execute a real workflow (API call, navigation, copy/share, file action), or
2. Be rendered disabled with a clear "Coming soon" or eligibility reason.

**Why:** Current dead controls create broken trust and untestable UX.

**Alternatives considered:**
- Keep placeholders to ship visuals quickly: rejected because it causes user-facing false affordances.

### 2) Replace placeholder collections with data adapters

**Decision:** Remove hardcoded empty collections (`const ...: any[] = []`) from seeker pages and source data from APIs or explicit feature flags.

**Why:** Placeholder arrays permanently force empty state and hide broken workflows.

**Alternatives considered:**
- Keep placeholders and only wire click handlers: rejected because actions still lack entity context.

### 3) Add missing seeker backend endpoints additively

**Decision:** Keep current endpoint conventions and add missing seeker-focused endpoints needed for alerts/referrals/cv-settings/subscription actions as additive APIs.

**Why:** Existing `apiCall()` abstraction and function namespace are already integrated; additive endpoints avoid breaking consumers.

**Alternatives considered:**
- Replace all seeker endpoints with a new API version: rejected as too broad for targeted QA fixes.

### 4) Standardize workflow states per page

**Decision:** Each seeker page implements shared workflow-state semantics:
- Initial load state
- Action in-progress state
- Empty state
- Recoverable error state (toast + inline fallback where relevant)

**Why:** Current behavior is inconsistent and often fails silently.

**Alternatives considered:**
- Only toasts for all failures: rejected because users lose context when actions fail.

### 5) Verify with route-level and workflow-level regression checks

**Decision:** Add seeker route smoke checks and workflow integration checks for primary actions.

**Why:** Prevent regression to dead controls and static-only behavior.

**Alternatives considered:**
- Rely on manual QA only: rejected due high repeatability cost.

## Risks / Trade-offs

- **[Risk] Backend scope creep from missing endpoints** → Mitigation: implement only APIs required by exposed seeker controls and keep contracts minimal/additive.
- **[Risk] Existing UI semantics change where controls become disabled** → Mitigation: explicit labels/tooltips to explain temporary non-availability.
- **[Risk] Inconsistent data shape from older rows** → Mitigation: normalize responses in page adapters and provide defaults.
- **[Risk] Increased test maintenance** → Mitigation: focus tests on critical user outcomes and stable selectors.

## Migration Plan

1. Inventory each seeker page control and map it to target behavior (navigate/mutate/view/share/download/toggle).
2. Implement/add required backend endpoints for seeker workflows that have no current API support.
3. Wire seeker pages to real data and handlers, removing placeholder arrays/anchors.
4. Add consistent loading/empty/error/action states.
5. Add/extend integration and smoke tests for seeker routes/workflows.
6. Validate with build + seeker workflow checks before merge.

Rollback strategy:
- Revert change set at git level; APIs are additive so rollback risk is low.
- Keep UI controls disabled rather than dead if backend behavior is temporarily reverted.

## Open Questions

- Should referrals remain seeker-visible if earnings logic is still stubbed server-side, or be gated behind a feature flag until payouts are enabled?
- For subscription actions, should plan changes be immediate or routed to a billing checkout provider first?
- Should CV download be generated server-side (canonical) or client-side (faster but potentially inconsistent formatting)?