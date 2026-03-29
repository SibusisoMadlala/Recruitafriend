## ADDED Requirements

### Requirement: Employer onboarding SHALL replace immediate employer activation
The system SHALL collect onboarding submission details for employer signups and SHALL mark new employer accounts as `pending_review` until an admin decision is recorded.

#### Scenario: Employer submits onboarding application
- **WHEN** a new employer completes required onboarding fields and submits required documents
- **THEN** the system stores an onboarding submission, sets employer status to `pending_review`, and confirms submission receipt to the employer

#### Scenario: Incomplete onboarding submission is rejected
- **WHEN** an employer attempts to submit onboarding without required fields or mandatory documents
- **THEN** the system rejects submission validation, lists missing requirements, and does not create a review-ready submission

### Requirement: Employer onboarding SHALL support remediation loops
The system SHALL support `needs_info` remediation so employers can provide additional details without creating a duplicate account.

#### Scenario: Employer updates application after info request
- **WHEN** an admin requests additional information and the employer resubmits updated details
- **THEN** the system preserves submission history, transitions status back to `pending_review`, and records a new submission revision timestamp

### Requirement: Employer onboarding documents SHALL be traceable
The system SHALL maintain document metadata and verification status per submission to support review transparency.

#### Scenario: Reviewer inspects submitted documents
- **WHEN** an admin opens an onboarding submission
- **THEN** the system shows required document set, file metadata, and per-document verification status for that submission