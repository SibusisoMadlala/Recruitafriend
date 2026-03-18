## ADDED Requirements

### Requirement: Saved jobs page SHALL support actionable saved-job management
The system SHALL load saved jobs for the authenticated seeker and SHALL support remove/share/apply actions for each job card.

#### Scenario: Saved jobs load
- **WHEN** the seeker opens `/seeker/saved`
- **THEN** the system fetches saved jobs and renders cards with job metadata and saved state

#### Scenario: Remove saved job
- **WHEN** the seeker activates the remove action for a saved job
- **THEN** the system deletes the saved-job relationship and removes the card from the current list

### Requirement: Saved jobs filtering SHALL affect rendered results
The system SHALL apply selected filter tabs to the current saved jobs dataset.

#### Scenario: Filter selection updates list
- **WHEN** the seeker changes the saved-jobs filter
- **THEN** the list updates to show only items matching the selected filter criteria