## MODIFIED Requirements

### Requirement: Row actions SHALL execute valid workflows
The system SHALL wire application-row actions to valid workflows for job viewing, withdrawal, next-step guidance, and workflow email outcomes.

#### Scenario: View Job action
- **WHEN** the seeker selects "View Job"
- **THEN** the system navigates to the matching job detail route

#### Scenario: Withdraw action
- **WHEN** the seeker selects "Withdraw" and confirms
- **THEN** the system updates the application status through an API call and refreshes the row state

#### Scenario: Withdraw action email outcome visibility
- **WHEN** a withdrawal action completes
- **THEN** the system receives delivery-state metadata indicating whether required workflow notifications were sent, skipped, or failed without misreporting the underlying workflow action result
