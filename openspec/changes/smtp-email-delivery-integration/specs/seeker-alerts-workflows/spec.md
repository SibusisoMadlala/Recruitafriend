## MODIFIED Requirements

### Requirement: Alert creation SHALL persist seeker alert definitions
The system SHALL allow seekers to create job alerts from the alerts form, persist them for future matching, and store delivery-related configuration needed for email dispatch.

#### Scenario: Create alert successfully
- **WHEN** the seeker submits valid alert criteria
- **THEN** the system creates an alert record with delivery configuration and displays it in the active alerts list

#### Scenario: Validation failure on create
- **WHEN** required alert fields are missing or invalid
- **THEN** the system prevents submission, displays field-level validation feedback, and does not queue alert email dispatch

### Requirement: Alert management controls SHALL be functional
The system SHALL support edit, delete, and active-state toggling for existing alerts, and these state changes SHALL govern future alert email delivery behavior.

#### Scenario: Toggle alert active state
- **WHEN** the seeker toggles an alert between active and paused
- **THEN** the system persists the new status, reflects it in the UI, and includes or excludes the alert from future email dispatch accordingly

#### Scenario: Delete alert
- **WHEN** the seeker confirms alert deletion
- **THEN** the system removes the alert, updates the list without full-page reload, and prevents any future alert emails for that alert

## ADDED Requirements

### Requirement: Active alert workflows SHALL dispatch seeker alert emails based on configured frequency
The system SHALL dispatch alert emails for active alerts according to each alert’s configured frequency.

#### Scenario: Dispatch daily alert email
- **WHEN** an alert is active and configured for daily frequency
- **THEN** the system sends a daily alert email with matching jobs for that alert criteria

#### Scenario: Dispatch weekly alert email
- **WHEN** an alert is active and configured for weekly frequency
- **THEN** the system sends a weekly alert email with matching jobs for that alert criteria

#### Scenario: Paused alert suppresses dispatch
- **WHEN** an alert is paused
- **THEN** the system MUST NOT send alert emails for that alert until reactivated