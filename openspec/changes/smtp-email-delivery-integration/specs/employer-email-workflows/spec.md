## ADDED Requirements

### Requirement: Employer team invite workflows SHALL send invite emails
The system SHALL send a team invite email when an employer submits a valid teammate invite action.

#### Scenario: Team invite created
- **WHEN** an employer adds and saves a valid teammate email invite
- **THEN** the system dispatches a team invite email through the shared product email delivery capability

#### Scenario: Invalid team invite email
- **WHEN** an employer submits an invalid invite email
- **THEN** the system rejects the action and no email is sent

### Requirement: Employer interview invitation workflows SHALL send candidate emails
The system SHALL dispatch interview invitation emails for employer interview invite actions.

#### Scenario: Interview invite triggered
- **WHEN** an employer triggers an interview invitation for a candidate
- **THEN** the system sends an interview invite email using the configured invitation template

#### Scenario: Interview invite send failure
- **WHEN** an interview invite email cannot be delivered
- **THEN** the system records the failure and returns a recoverable error to the triggering workflow

### Requirement: Employer template-based communications SHALL validate template variables before send
The system SHALL validate required template variables before rendering and dispatching employer communications.

#### Scenario: Template variables complete
- **WHEN** all required template variables are provided
- **THEN** the system renders and sends the email content

#### Scenario: Template variables missing
- **WHEN** one or more required template variables are missing
- **THEN** the system rejects dispatch with a validation error and does not send the email