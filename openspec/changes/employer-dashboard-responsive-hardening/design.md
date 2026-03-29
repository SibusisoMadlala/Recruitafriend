## Context

The employer experience is rendered through a composed shell: `EmployerSidebar` + `Navbar` + routed page content in `EmployerLayout`. Current responsive behavior shows coordination gaps at mobile and tablet breakpoints, especially around top offset assumptions, layered toggles/overlays, and visual alignment between constrained and unconstrained content containers.

The shell currently mixes:
- Fixed sidebar behavior (`w-64`, fixed positioning at `md+`)
- Sticky top navbar behavior
- A mobile top padding offset in layout that was originally useful for fixed headers

This combination can produce inconsistent spacing and interaction overlap when viewport width changes.

## Goals / Non-Goals

**Goals:**
- Establish a single, predictable responsive contract for employer shell composition.
- Eliminate breakpoint-specific overlap/misalignment between sidebar, navbar, and main content.
- Keep employer navigation actions reachable on mobile without menu-state conflicts.
- Add responsive regression checks to prevent future shell drift.

**Non-Goals:**
- Rebrand or redesign visual style of employer pages.
- Change backend APIs, authentication, or route structures.
- Rework seeker shell behavior unless shared navbar logic changes are strictly required.

## Decisions

1. **Use flow-consistent top spacing in `EmployerLayout`**
   - Decision: Remove or neutralize mobile top padding that compensates for fixed headers when the in-layout navbar is sticky.
   - Rationale: Sticky navbars remain in document flow; fixed-header compensation causes unnecessary offset and visual misalignment.
   - Alternative considered: Make navbar fixed everywhere and keep padding compensation.
   - Why not alternative: Increases complexity (z-index, content offset sync, scroll behavior) with no functional gain.

2. **Define clear ownership for mobile navigation controls**
   - Decision: Preserve both employer sidebar toggle and navbar mobile menu only if they do not overlap functionally/visually; otherwise reduce to one canonical control in employer shell.
   - Rationale: Competing controls at the same viewport tier increase cognitive load and can create layered UI conflicts.
   - Alternative considered: Leave both controls as-is and only tweak z-index.
   - Why not alternative: Treats symptoms, not interaction model clarity.

3. **Align container strategy for shell chrome and content**
   - Decision: Harmonize container width behavior so navbar and main content feel intentionally aligned across `md`/`lg` transitions.
   - Rationale: Mixed constrained/unconstrained containers can appear broken even when technically valid.
   - Alternative considered: Keep current max-width navbar while content remains fully fluid.
   - Why not alternative: Continues perceived misalignment and inconsistent visual rhythm.

4. **Codify responsive shell assertions in tests**
   - Decision: Extend responsive regression coverage to include employer layout-specific top spacing, toggle visibility/state, and overflow boundary expectations.
   - Rationale: Existing tests validate toggles but do not fully protect layout composition regressions.
   - Alternative considered: Rely on manual QA only.
   - Why not alternative: Regressions are likely to recur without automated guards.

## Risks / Trade-offs

- **[Risk] Shared navbar changes could affect non-employer routes** → Mitigation: Scope employer-specific behavior via layout composition and route-aware rendering; keep root route behavior covered by existing tests.
- **[Risk] Removing padding compensation may expose hidden content assumptions in individual employer pages** → Mitigation: Validate dashboard and representative employer pages under 390px, 768px, and 1024px viewport widths.
- **[Risk] Simplifying mobile controls might reduce discoverability for one entry path** → Mitigation: Retain clear iconography, `aria-label`s, and predictable open/close behavior in tests.
- **[Trade-off] Minor visual adjustments may be required across employer pages** → Mitigation: Prefer shell-level fixes first; only adjust page-level layout where necessary.
