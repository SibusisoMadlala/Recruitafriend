## ADDED Requirements

### Requirement: Shared navigation SHALL remain reachable across viewport sizes
The system SHALL preserve access to primary public and authenticated navigation actions on mobile, tablet, and desktop viewports without clipping or removing the only path to those actions.

#### Scenario: Public navigation on mobile
- **WHEN** a visitor opens the site on a narrow viewport
- **THEN** the system provides an accessible mobile navigation pattern that exposes primary routes and auth actions

#### Scenario: Authenticated navigation on desktop
- **WHEN** an authenticated user views the site on a desktop viewport
- **THEN** the system preserves direct access to the primary dashboard and account actions without requiring the mobile navigation pattern

### Requirement: Protected shells SHALL adapt from desktop sidebars to narrow-screen layouts
The system SHALL adapt protected seeker and employer shells so navigation and content remain usable on narrow screens while preserving persistent sidebar behavior on larger screens.

#### Scenario: Seeker shell on mobile
- **WHEN** a seeker opens any `/seeker/*` route on a narrow viewport
- **THEN** the system presents navigation in a collapsible or overlay pattern and prioritizes the page content area within the available width

#### Scenario: Employer shell on tablet or desktop
- **WHEN** an employer opens any `/employer/*` route on a tablet or desktop viewport
- **THEN** the system keeps navigation discoverable and does not overlap or obscure the main content area

### Requirement: High-traffic pages SHALL avoid accidental horizontal overflow
The system SHALL prevent homepage, signup, and employer applicant flows from introducing accidental page-level horizontal scrolling on narrow screens, except where an intentionally scrollable data region is required.

#### Scenario: Homepage and signup stack safely on mobile
- **WHEN** a user opens the homepage or signup page on a narrow viewport
- **THEN** the system stacks controls, cards, and call-to-action sections within the viewport width without clipping key content

#### Scenario: Applicant board uses bounded overflow
- **WHEN** an employer opens the applicants workflow on a narrow viewport
- **THEN** any required horizontal scrolling is limited to the intended board or table region and surrounding controls remain reachable

### Requirement: Responsive behavior SHALL be verified for representative viewport ranges
The system SHALL include regression verification for representative mobile, tablet, and desktop viewport ranges covering shared navigation and protected shells.

#### Scenario: Automated or scripted viewport verification
- **WHEN** responsive verification is executed for representative routes
- **THEN** the checks confirm that navigation is reachable, primary controls remain visible, and no unintended full-page horizontal overflow is introduced
