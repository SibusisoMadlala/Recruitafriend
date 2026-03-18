## 1. Audit baseline and implementation map

- [x] 1.1 Build a seeker control-action matrix for `SeekerDashboard`, `SeekerApplications`, `SeekerSavedJobs`, `SeekerAlerts`, `SeekerCV`, `VideoInterviews`, `Networking`, and `SeekerSubscriptions`
- [x] 1.2 Mark every currently dead control as one of: implement now, disable with explanation, or hide behind feature flag
- [x] 1.3 Define required API contracts and payload shapes for each control action

## 2. Seeker dashboard workflow fixes

- [x] 2.1 Replace placeholder dashboard collections with API-backed state and typed adapters
- [x] 2.2 Wire Application Pipeline stage interactions to filtered `/seeker/applications` navigation
- [x] 2.3 Wire recommended-jobs navigation controls to functional pagination/carousel behavior (or disabled state when no data)
- [x] 2.4 Add loading/error/empty states for dashboard cards and widgets

## 3. Seeker applications and saved-jobs fixes

- [x] 3.1 Load applications from API in `SeekerApplications.tsx` and map status tabs to real status values
- [x] 3.2 Implement row actions (`View Job`, `Withdraw`, next-step action buttons) with success/error handling
- [x] 3.3 Load saved jobs from API in `SeekerSavedJobs.tsx` and remove static empty list usage
- [x] 3.4 Implement saved-job actions (`Remove`, `Share`, `Apply Now`) and update list state without full reload

## 4. Seeker alerts, CV, and profile action fixes

- [x] 4.1 Implement alert creation form submission and input validation in `SeekerAlerts.tsx`
- [x] 4.2 Implement alert edit/delete/active-toggle actions and state refresh
- [x] 4.3 Replace dead alert email `href="#"` anchors with valid routes or explicit disabled treatment
- [x] 4.4 Implement CV template selection persistence, visibility toggle persistence, and profile-sync action
- [x] 4.5 Implement CV download and uploaded-file actions (replace/edit/delete) with clear success/error outcomes

## 5. Networking/referrals and subscription action fixes

- [x] 5.1 Implement referral copy-to-clipboard with user feedback in `Networking.tsx`
- [x] 5.2 Implement referral share actions (WhatsApp + device share fallback)
- [x] 5.3 Integrate referral metrics/activity with backend data and robust empty-state handling
- [x] 5.4 Implement subscription plan action handlers for non-current plans and free-trial CTA behavior

## 6. Backend support for seeker workflows

- [x] 6.1 Add/extend edge-function endpoints needed by alerts, referrals, CV settings, and subscription actions
- [x] 6.2 Ensure endpoint responses are additive and compatible with existing `apiCall()` behavior
- [x] 6.3 Add authorization checks for seeker-owned resources and return consistent error payloads

## 7. Regression testing and verification

- [x] 7.1 Add seeker route smoke tests verifying all `/seeker/*` pages render without dead primary controls
- [x] 7.2 Add workflow tests for applications actions, saved-jobs actions, alerts CRUD, referral copy/share, and subscription actions
- [x] 7.3 Run build and automated test suite; fix regressions introduced by seeker workflow changes
- [x] 7.4 Execute manual QA checklist for seeker journeys and capture pass/fail evidence before merge