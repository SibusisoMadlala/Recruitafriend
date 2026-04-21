## ADDED Requirements

### Requirement: Application submission workflows SHALL notify both participants
The system SHALL dispatch transactional emails to both the job employer and the applicant when a seeker submits a valid job application.

#### Scenario: Employer receives new application summary
- **WHEN** a seeker submits an application successfully
- **THEN** the system sends an employer notification email with a concise summary including applicant identity, job title, and submission timestamp

#### Scenario: Seeker receives submission receipt
- **WHEN** a seeker submits an application successfully
- **THEN** the system sends a seeker receipt email confirming the application was recorded with a concise summary of the submitted role and company

### Requirement: Application lifecycle workflows SHALL notify status progression outcomes
The system SHALL dispatch applicant-facing lifecycle emails for meaningful stage transitions and interview progression events.

#### Scenario: Stage transition email
- **WHEN** an employer moves an application from one stage to another
- **THEN** the system sends a status transition email to the applicant including from-stage and to-stage labels

#### Scenario: Interview stage email
- **WHEN** an employer advances an application to interview with scheduling metadata
- **THEN** the system sends an interview invitation email that includes schedule and join details when available

### Requirement: Application notification dispatch SHALL be idempotent and observable
The system SHALL prevent duplicate sends for retried application notification events and SHALL persist delivery outcomes for support diagnostics.

#### Scenario: Duplicate submit notification request
- **WHEN** the same application-submission notification event is replayed with the same event key
- **THEN** the system does not send a duplicate outbound email

#### Scenario: Delivery failure during notification
- **WHEN** SMTP delivery fails for an application workflow notification
- **THEN** the system records the failed attempt with error metadata while preserving the underlying workflow business outcome

### Requirement: Application notification recipient resolution SHALL use fallback lookups
The system SHALL attempt recipient resolution using profile email first and fallback to auth-user email lookup when profile email is missing.

#### Scenario: Missing profile email with auth fallback available
- **WHEN** the recipient profile has no valid email and auth-user email lookup returns a valid address
- **THEN** the system sends the notification to the fallback auth-user email

#### Scenario: No resolvable recipient email
- **WHEN** neither profile nor auth-user lookup yields a valid email address
- **THEN** the system skips send, logs the skipped condition, and returns delivery-state metadata without failing the workflow action
