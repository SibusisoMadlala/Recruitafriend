## ADDED Requirements

### Requirement: Employer shell SHALL preserve non-overlapping responsive composition
The system SHALL render employer sidebar, navbar, and main content without overlap or unintended blank offset across supported breakpoints.

#### Scenario: Mobile shell layout uses flow-consistent top spacing
- **WHEN** an employer opens an employer route on a viewport smaller than the `md` breakpoint
- **THEN** the navbar and main content render without fixed-header compensation gaps and without clipping the top of page content

#### Scenario: Desktop shell layout respects fixed sidebar width
- **WHEN** an employer opens an employer route on a viewport at or above the `md` breakpoint
- **THEN** the main content area is offset to account for the fixed employer sidebar and remains fully visible within the viewport

### Requirement: Employer mobile navigation controls SHALL have deterministic interaction behavior
The system SHALL provide predictable menu state and layering behavior for employer mobile navigation controls.

#### Scenario: Sidebar toggle state is reflected accurately
- **WHEN** an employer activates the employer sidebar toggle on mobile
- **THEN** the sidebar open state, toggle accessibility attributes, and overlay visibility remain synchronized

#### Scenario: Mobile overlays do not trap unrelated interactions
- **WHEN** a mobile navigation surface is open in the employer shell
- **THEN** background content interaction is blocked only by the active overlay and is restored immediately when the surface closes

### Requirement: Employer shell responsiveness SHALL be regression-tested
The system SHALL include automated responsive tests that validate employer shell composition and control behavior at representative viewport widths.

#### Scenario: Responsive regression test covers employer shell breakpoints
- **WHEN** responsive layout tests run in CI
- **THEN** they validate employer shell behavior at mobile and desktop widths, including toggle states and container overflow boundaries
