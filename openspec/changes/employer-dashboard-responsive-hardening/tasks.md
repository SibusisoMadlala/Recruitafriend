## 1. Employer shell layout alignment

- [x] 1.1 Remove mobile top-offset compensation from `EmployerLayout` where it conflicts with sticky navbar flow.
- [x] 1.2 Verify desktop sidebar offset (`md:ml-64` and related classes) keeps main content fully visible across `md` and `lg` widths.
- [x] 1.3 Harmonize employer shell container behavior so navbar and main content alignment is visually consistent.

## 2. Mobile navigation interaction hardening

- [x] 2.1 Resolve mobile control ownership between `EmployerSidebar` toggle and navbar mobile menu to avoid overlapping interaction patterns.
- [x] 2.2 Ensure overlay/layering behavior is deterministic (open/close states, z-index ordering, and `aria-expanded` synchronization).
- [x] 2.3 Validate body scroll lock/unlock behavior across open/close and route changes in employer mobile navigation flows.

## 3. Regression coverage and QA validation

- [x] 3.1 Extend `responsive-layout` tests with employer-shell-specific assertions for top spacing and non-overlapping composition.
- [x] 3.2 Add viewport-based test checks for mobile and desktop employer shell behavior (e.g., 390px and 1280px equivalents).
- [x] 3.3 Run targeted responsive verification on `EmployerDashboard` and at least one additional employer page to confirm no overflow regressions.
