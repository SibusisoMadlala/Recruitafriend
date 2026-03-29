## Why

Employers are seeing layout conflicts on dashboard breakpoints where the sidebar, navbar, and main content do not coordinate cleanly (overlap, inconsistent offsets, and cramped controls). This degrades core navigation and dashboard usability on mobile/tablet devices, and should be corrected before additional employer features are layered on top.

## What Changes

- Harden employer shell responsiveness so sidebar, navbar, and main content align consistently across mobile, tablet, and desktop breakpoints.
- Remove conflicting offset behavior in the employer shell that assumes fixed headers when the header is sticky.
- Standardize responsive behavior for mobile navigation controls so menu states and overlays do not conflict.
- Add/expand responsive regression coverage for employer shell interactions (sidebar toggle, navbar menu behavior, and content container boundaries).

## Capabilities

### New Capabilities
- `employer-shell-responsive-workflows`: Defines required responsive behavior for employer navigation shell composition (sidebar, navbar, main content) and breakpoint-safe interaction rules.

### Modified Capabilities
- None.

## Impact

- Affected UI shell components: `src/app/layouts/EmployerLayout.tsx`, `src/app/components/EmployerSidebar.tsx`, `src/app/components/Navbar.tsx`.
- Affected employer dashboard presentation/layout composition: `src/app/pages/EmployerDashboard.tsx`.
- Affected regression tests: `src/app/components/__tests__/responsive-layout.test.tsx` (and potentially new employer-specific responsive assertions).
- No backend, API, or database schema changes expected.
