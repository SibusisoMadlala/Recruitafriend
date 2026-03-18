## Context

RecruitFriend currently mixes responsive and desktop-only patterns. The public shell hides navigation below `md` without presenting an equivalent mobile menu, the seeker shell uses a permanently visible fixed-width sidebar, and some employer pages rely on fixed minimum widths or absolute positioning that only behave well on large screens. The change is cross-cutting because it affects shared components, protected layouts, and priority pages that inherit shell behavior.

## Goals / Non-Goals

**Goals:**
- Establish one consistent responsive navigation pattern for public and authenticated experiences.
- Replace desktop-only seeker shell behavior with a narrow-screen navigation model that preserves access to core routes.
- Reduce layout breakage caused by fixed widths, oversized spacing, and unmanaged horizontal overflow on key pages.
- Define a verification approach for mobile, tablet, and desktop viewport ranges.

**Non-Goals:**
- Rebrand or redesign the visual identity of the product.
- Rewrite every page to be fully mobile-optimized in a single pass; this change focuses on shared shells and the highest-traffic layouts.
- Introduce backend, routing, or authorization changes unrelated to responsive presentation.

## Decisions

### 1) Use shell-first responsive remediation

**Decision:** Fix shared layout components before page-specific polish, starting with `Navbar`, `SeekerLayout`, `EmployerLayout`, and `EmployerSidebar`.

**Why:** Most visible breakage originates in shared shells. Fixing these first improves many routes immediately and reduces duplicated page-level overrides.

**Alternatives considered:**
- Patch each page independently: rejected because it would duplicate navigation logic and leave cross-route inconsistencies.

### 2) Use progressive disclosure for mobile navigation

**Decision:** On narrow viewports, shared navigation will move into a collapsible menu or drawer, while desktop keeps inline navigation.

**Why:** Mobile screens cannot safely fit the current inline links, auth actions, and dashboard entry points without either clipping or wrapping into unstable layouts.

**Alternatives considered:**
- Keep navigation inline and wrap to multiple rows: rejected because it increases header height unpredictably and still degrades task completion.

### 3) Treat fixed-width workflow views as intentionally scrollable only when the data model demands it

**Decision:** Dense workflows such as the employer applicant kanban may retain horizontal scrolling, but the surrounding controls, spacing, and entry points must remain usable on small screens.

**Why:** Some data-rich boards do not compress well into a fully stacked mobile layout without losing meaning. The fix should distinguish acceptable horizontal board scrolling from accidental page overflow.

**Alternatives considered:**
- Force every wide workflow into card-only mobile views in this change: rejected as valuable but too broad for the initial hardening pass.

### 4) Standardize breakpoint behavior through content spacing and width rules

**Decision:** Reduce large default paddings on small screens, prefer stack-first layouts below medium breakpoints, and use explicit overflow handling for tables, boards, and filter bars.

**Why:** Current layout issues are caused as much by spacing and width assumptions as by missing menus.

**Alternatives considered:**
- Only add a mobile menu: rejected because content regions would still overflow or feel cramped.

### 5) Add viewport-based regression validation for shared shells

**Decision:** Add or extend UI verification to cover at least one mobile, tablet, and desktop viewport for shared navigation and key layouts.

**Why:** Responsive regressions are easy to reintroduce when components are reused across many routes.

**Alternatives considered:**
- Manual QA only: rejected because shell-level regressions are repetitive and well suited to automated checks.

## Risks / Trade-offs

- **[Risk] Mobile drawers and toggles add interaction complexity** → Mitigation: keep patterns aligned between public and authenticated shells and limit statefulness to open/close behavior.
- **[Risk] Some wide employer workflows will still require horizontal scrolling** → Mitigation: constrain scrolling to the intended content region and ensure surrounding actions remain reachable.
- **[Risk] Breakpoint adjustments may shift existing desktop spacing** → Mitigation: preserve desktop behavior at current large-screen breakpoints and focus changes below them.
- **[Risk] Responsive tests can be brittle if they depend on styling details** → Mitigation: verify user-visible outcomes such as menu reachability, absence of clipped controls, and usable overflow regions.

## Migration Plan

1. Update shared navigation and protected shells to support narrow-screen interaction patterns.
2. Adjust homepage, signup, and employer applicant surfaces to consume the new shell behavior and remove the most severe width assumptions.
3. Add responsive verification coverage for representative routes and viewport sizes.
4. Validate via local build/test runs and targeted manual checks before merge.

Rollback strategy:
- Revert the frontend changeset if regressions appear.
- Because no backend contracts change, rollback is isolated to UI behavior.

## Open Questions

- Should the seeker shell use the same overlay drawer pattern as the employer shell, or should it collapse into a different mobile navigation treatment?
- For the employer applicant list view, is a later mobile-specific card presentation desirable after the initial hardening pass?
- Which responsive checks belong in automated tests versus a short manual QA matrix?
