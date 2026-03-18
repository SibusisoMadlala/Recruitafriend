## Why

The current RecruitFriend UI is only partially responsive: the public navigation loses key actions on small screens, the seeker shell remains desktop-only, and high-traffic employer screens still assume wide viewports. This creates broken mobile journeys for discovery, signup, dashboard use, and applicant review at a point where responsive behavior should be a baseline expectation.

## What Changes

- Introduce a mobile-safe navigation pattern for shared public and authenticated headers, including preserved access to core routes and auth actions on small screens.
- Adapt the seeker application shell to support narrow viewports with a collapsible navigation experience, reduced spacing, and content-first stacking.
- Harden responsive behavior on employer workflows that currently depend on fixed widths, with special attention to applicant review surfaces.
- Normalize responsive spacing, overflow handling, and breakpoint behavior across key entry pages such as the homepage and signup flow.
- Add verification coverage for critical viewport ranges so regressions in layout adaptation are caught early.

## Capabilities

### New Capabilities
- `responsive-layout-adaptation`: Responsive requirements for shared navigation, protected app shells, and high-traffic pages across mobile, tablet, and desktop viewports.

### Modified Capabilities
- None.

## Impact

- Affected frontend layout/components: `src/app/components/Navbar.tsx`, `Footer.tsx`, `EmployerSidebar.tsx`, `src/app/layouts/SeekerLayout.tsx`, and `EmployerLayout.tsx`.
- Affected pages: `src/app/pages/Homepage.tsx`, `Signup.tsx`, `EmployerApplicants.tsx`, plus other pages relying on the shared shells.
- Testing impact: add or extend responsive regression coverage for shared navigation, protected shells, and priority page layouts.
- No intended backend or API contract changes; scope is limited to frontend layout behavior and validation coverage.
