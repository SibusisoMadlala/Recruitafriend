## 1. Shared navigation hardening

- [x] 1.1 Add a responsive mobile navigation pattern to `src/app/components/Navbar.tsx` that preserves primary routes and auth actions on narrow screens
- [x] 1.2 Verify shared footer and header spacing do not introduce horizontal overflow on public pages
- [x] 1.3 Confirm desktop navigation behavior remains intact for authenticated and unauthenticated users

## 2. Protected shell adaptation

- [x] 2.1 Refactor `src/app/layouts/SeekerLayout.tsx` for a mobile-friendly navigation experience with content-first spacing
- [x] 2.2 Align `src/app/components/EmployerSidebar.tsx` and `src/app/layouts/EmployerLayout.tsx` with the shared responsive shell behavior
- [x] 2.3 Audit shared shell paddings, heights, and overflow handling to remove desktop-only assumptions

## 3. Priority page responsive fixes

- [x] 3.1 Update `src/app/pages/Homepage.tsx` so hero search, stats, and CTA sections stack cleanly on narrow viewports
- [x] 3.2 Update `src/app/pages/Signup.tsx` to avoid cramped two-column controls on very small screens
- [x] 3.3 Update `src/app/pages/EmployerApplicants.tsx` so filters, list view, and kanban overflow remain usable on mobile

## 4. Verification

- [x] 4.1 Add or extend responsive regression coverage for representative mobile, tablet, and desktop viewports
- [x] 4.2 Run build and targeted verification for shared navigation, protected shells, and the priority responsive pages
