## ADDED Requirements

### Requirement: Alert creation SHALL persist seeker alert definitions
The system SHALL allow seekers to create job alerts from the alerts form and persist them for future delivery matching.

#### Scenario: Create alert successfully
- **WHEN** the seeker submits valid alert criteria
- **THEN** the system creates an alert record and displays it in the active alerts list

#### Scenario: Validation failure on create
- **WHEN** required alert fields are missing or invalid
- **THEN** the system prevents submission and displays field-level validation feedback

### Requirement: Alert management controls SHALL be functional
The system SHALL support edit, delete, and active-state toggling for existing alerts.

#### Scenario: Toggle alert active state
- **WHEN** the seeker toggles an alert between active and paused
- **THEN** the system persists the new status and reflects it in the UI

#### Scenario: Delete alert
- **WHEN** the seeker confirms alert deletion
- **THEN** the system removes the alert and updates the list without full-page reload
