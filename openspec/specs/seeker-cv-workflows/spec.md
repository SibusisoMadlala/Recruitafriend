## ADDED Requirements

### Requirement: CV action controls SHALL perform explicit workflows
The system SHALL make CV controls functional for template selection, visibility toggling, profile-sync refresh, and downloadable output.

#### Scenario: Template selection
- **WHEN** the seeker selects a CV template option
- **THEN** the preview updates to the selected template and selection state persists for the user

#### Scenario: CV visibility toggle
- **WHEN** the seeker toggles CV/profile visibility
- **THEN** the system saves the visibility setting and reflects the effective state in the UI

### Requirement: CV download/upload actions SHALL provide clear outcomes
The system SHALL provide a valid download action and explicit upload/edit/delete outcomes for user CV files.

#### Scenario: Download CV
- **WHEN** the seeker clicks "Download PDF"
- **THEN** the system starts a valid PDF download or displays an actionable error message

#### Scenario: Replace uploaded CV
- **WHEN** the seeker uploads or replaces a CV file
- **THEN** the system stores the file reference and updates the displayed file metadata
