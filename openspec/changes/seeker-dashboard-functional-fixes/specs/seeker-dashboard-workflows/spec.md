## ADDED Requirements

### Requirement: Dashboard controls SHALL map to real behavior
The system SHALL ensure every primary control on the seeker dashboard performs a real action (navigation, filtered view, or API-backed mutation) and SHALL NOT render non-functional interactive affordances.

#### Scenario: Pipeline stage interaction is functional
- **WHEN** a seeker clicks a stage in the Application Pipeline widget
- **THEN** the system navigates to `/seeker/applications` with the selected stage filter applied

#### Scenario: Recommended jobs navigation controls are valid
- **WHEN** a seeker uses recommended-jobs navigation controls
- **THEN** the system updates the visible recommendation set or disables controls with an explicit reason

### Requirement: Dashboard data SHALL be sourced from APIs
The system SHALL populate dashboard metrics and widgets from seeker APIs and SHALL show deterministic loading, empty, and error states.

#### Scenario: Dashboard load succeeds
- **WHEN** dashboard APIs return application, saved-job, and profile-view data
- **THEN** the dashboard cards and activity widgets display the returned values

#### Scenario: Dashboard load fails partially
- **WHEN** one or more dashboard API requests fail
- **THEN** the system preserves available data, shows a user-visible error message, and keeps the page interactive