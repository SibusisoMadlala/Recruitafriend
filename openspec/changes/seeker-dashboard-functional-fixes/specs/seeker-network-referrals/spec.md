## ADDED Requirements

### Requirement: Referral actions SHALL execute copy/share workflows
The system SHALL make seeker referral controls functional for link copy and share intents.

#### Scenario: Copy referral link
- **WHEN** the seeker clicks the copy control
- **THEN** the referral link is copied to clipboard and a success indicator is shown

#### Scenario: Share referral link
- **WHEN** the seeker selects a share option (WhatsApp or device share)
- **THEN** the system launches the corresponding share flow with the referral link payload

### Requirement: Referral activity SHALL be data-driven
The system SHALL render referral earnings and activity from backend referral data or show explicit empty states.

#### Scenario: No referral activity
- **WHEN** the referral dataset is empty
- **THEN** the page shows zero-value metrics and a clear empty-state message

#### Scenario: Referral activity exists
- **WHEN** referral records are returned
- **THEN** metrics and activity sections display values derived from those records