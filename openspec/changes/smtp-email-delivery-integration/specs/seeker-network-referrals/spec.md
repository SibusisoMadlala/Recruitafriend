## MODIFIED Requirements

### Requirement: Referral actions SHALL execute copy/share workflows
The system SHALL make seeker referral controls functional for link copy, share intents, and email invite dispatch when a referee email is provided.

#### Scenario: Copy referral link
- **WHEN** the seeker clicks the copy control
- **THEN** the referral link is copied to clipboard and a success indicator is shown

#### Scenario: Share referral link
- **WHEN** the seeker selects a share option (WhatsApp or device share)
- **THEN** the system launches the corresponding share flow with the referral link payload

#### Scenario: Email referral invite
- **WHEN** the seeker provides a referee email and triggers a referral invite send action
- **THEN** the system dispatches a referral invite email through the shared product email delivery capability

### Requirement: Referral activity SHALL be data-driven
The system SHALL render referral earnings and activity from backend referral data or show explicit empty states, including referral invite send outcomes when available.

#### Scenario: No referral activity
- **WHEN** the referral dataset is empty
- **THEN** the page shows zero-value metrics and a clear empty-state message

#### Scenario: Referral activity exists
- **WHEN** referral records are returned
- **THEN** metrics and activity sections display values derived from those records and include invite send status metadata when present