## Why

The Seeker area currently contains many visible controls (buttons, links, toggles, and tabs) that appear actionable but do not trigger any behavior, and multiple screens render static empty placeholders instead of user data. This creates broken user journeys from dashboard entry to application management, saved jobs, alerts, CV actions, networking referrals, and subscription actions, causing low trust and poor conversion.

## What Changes

- Replace placeholder-only Seeker pages with functional, data-backed workflows using existing and new server endpoints where required.
- Implement actionable behavior for currently dead UI controls (e.g., Apply/Withdraw/View actions, alert CRUD controls, referral copy/share actions, subscription plan actions, CV action controls, and interview utility controls).
- Ensure Seeker dashboard widgets are connected to real data and valid navigation targets (pipeline stages, recent activity links, recommended job controls).
- Add consistent loading, empty, success, and error states for Seeker workflows.
- Add regression coverage for key Seeker workflows and route-level smoke checks.

## Capabilities

### New Capabilities
- `seeker-dashboard-workflows`: Functional and testable seeker dashboard widgets, links, and primary actions connected to real data.
- `seeker-applications-workflows`: End-to-end seeker application list actions, status filtering, and navigation to related job/interview flows.
- `seeker-saved-jobs-workflows`: Functional saved-jobs list, remove/share/apply actions, and filtered views.
- `seeker-alerts-workflows`: Functional job-alert creation, listing, editing, deletion, and enable/disable behavior.
- `seeker-cv-workflows`: Functional CV preview actions including template selection, download trigger, visibility toggle, and profile-sync action.
- `seeker-network-referrals`: Functional referral link copy/share behavior and referral activity rendering.
- `seeker-subscription-actions`: Functional plan-change and trial-start actions with clear current-plan handling.

### Modified Capabilities
- None.

## Impact

- Affected frontend pages/components: `src/app/pages/SeekerDashboard.tsx`, `SeekerApplications.tsx`, `SeekerSavedJobs.tsx`, `SeekerAlerts.tsx`, `SeekerCV.tsx`, `VideoInterviews.tsx`, `Networking.tsx`, `SeekerSubscriptions.tsx`, and related shared layout/navigation components.
- Affected frontend data access: `src/app/lib/supabase.ts`, seeker page API integration logic, and route navigation behavior.
- Affected backend function: `supabase/functions/server/index.tsx` for any missing seeker endpoints and action support (alerts/referrals/subscriptions/CV settings where absent).
- Testing impact: add seeker workflow integration checks and non-regression checks for dashboard interactions and protected seeker routes.
- No breaking API contract intentionally introduced; new endpoints/fields should be additive where possible.