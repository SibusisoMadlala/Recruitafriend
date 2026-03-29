## ADDED Requirements

### Requirement: Product workflows SHALL use centralized SMTP email orchestration
The system SHALL route product workflow email sends through a shared orchestration layer that validates payloads, resolves templates, enforces preferences, and dispatches via SMTP transport.

#### Scenario: Dispatch from supported workflow
- **WHEN** a supported workflow requests an email send
- **THEN** the orchestration layer validates the request and attempts SMTP delivery through the configured transport

#### Scenario: Unsupported workflow payload
- **WHEN** an email send request lacks required workflow metadata
- **THEN** the system rejects the request with a structured validation error and does not attempt delivery

### Requirement: Product email delivery SHALL be observable and auditable
The system SHALL persist email delivery attempts and outcomes with enough metadata to diagnose failures and trace user-impacting events.

#### Scenario: Successful delivery attempt
- **WHEN** SMTP handoff succeeds
- **THEN** the system records a success status with correlation metadata for the delivery attempt

#### Scenario: Failed delivery attempt
- **WHEN** SMTP delivery fails
- **THEN** the system records a failure status with error details and attempt metadata

### Requirement: Product email dispatch SHALL be idempotent for retriable workflows
The system SHALL prevent duplicate sends for the same business event by enforcing idempotency keys at orchestration time.

#### Scenario: Duplicate delivery request
- **WHEN** the same workflow event is submitted more than once with the same idempotency key
- **THEN** the system does not create a duplicate outbound email send

#### Scenario: New delivery request
- **WHEN** a workflow event is submitted with a new idempotency key
- **THEN** the system processes the request as a new delivery attempt