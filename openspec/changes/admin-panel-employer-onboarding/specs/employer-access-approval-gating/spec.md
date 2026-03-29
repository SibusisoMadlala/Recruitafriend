## ADDED Requirements

### Requirement: Employer route access SHALL require approved onboarding status
The system SHALL deny access to employer operational routes for authenticated employers whose status is not `approved`.

#### Scenario: Pending employer accesses employer dashboard
- **WHEN** an authenticated employer with status `pending_review` navigates to `/employer/dashboard`
- **THEN** the system redirects the employer to onboarding status/remediation flow and does not render employer dashboard content

#### Scenario: Approved employer accesses employer dashboard
- **WHEN** an authenticated employer with status `approved` navigates to `/employer/dashboard`
- **THEN** the system grants access and renders the employer dashboard

### Requirement: Employer API operations SHALL enforce approval status
Employer-restricted APIs SHALL require both employer role and `approved` onboarding status.

#### Scenario: Pending employer calls employer write endpoint
- **WHEN** an authenticated employer with status `pending_review` calls an employer-protected endpoint (for example, job posting)
- **THEN** the API returns a forbidden response with a status-specific message and no state change is committed

#### Scenario: Suspended employer attempts any employer operation
- **WHEN** an authenticated employer with status `suspended` attempts employer operations
- **THEN** the API denies access and returns suspension guidance metadata

### Requirement: Status transition effects SHALL be immediate
The system SHALL apply onboarding status transitions to authorization outcomes without requiring account recreation.

#### Scenario: Admin approval unlocks employer actions
- **WHEN** an admin changes employer status from `pending_review` to `approved`
- **THEN** subsequent route and API checks allow employer operations for that account