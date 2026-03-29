## ADDED Requirements

### Requirement: Admin onboarding queue SHALL present actionable employer submissions
The system SHALL provide an admin queue of employer onboarding submissions with status, age, and review readiness indicators.

#### Scenario: Admin views pending queue
- **WHEN** an admin opens the onboarding queue
- **THEN** the system lists pending and needs-info submissions with submission timestamp, company identity summary, and backlog age

### Requirement: Admin review actions SHALL support approve, reject, and request-info decisions
The system SHALL let admins make explicit onboarding decisions and persist reviewer attribution and decision rationale.

#### Scenario: Admin approves a submission
- **WHEN** an admin approves an eligible onboarding submission
- **THEN** the system marks employer status `approved`, records reviewer identity and decision timestamp, and marks employer as live

#### Scenario: Admin rejects a submission
- **WHEN** an admin rejects an onboarding submission with a reason
- **THEN** the system marks employer status `rejected`, stores rejection reason, and surfaces rejection outcome to employer status view

#### Scenario: Admin requests additional information
- **WHEN** an admin requests additional information with guidance notes
- **THEN** the system marks status `needs_info`, stores reviewer notes, and exposes remediation instructions to the employer

### Requirement: Admin review actions SHALL be auditable
The system SHALL record immutable audit events for onboarding decisions and sensitive admin actions.

#### Scenario: Audit log entry created for decision action
- **WHEN** an admin performs approve, reject, request-info, suspend, or reactivate actions
- **THEN** the system writes an audit event including actor, target employer, action type, timestamp, and decision metadata