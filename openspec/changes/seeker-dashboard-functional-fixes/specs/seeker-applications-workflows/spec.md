## ADDED Requirements

### Requirement: Applications list SHALL be data-backed
The system SHALL load seeker applications from backend data and SHALL render status tabs from actual application status values.

#### Scenario: Applications are displayed for authenticated seeker
- **WHEN** the seeker opens `/seeker/applications`
- **THEN** the system fetches the seeker applications and renders rows with job, company, date, and status

#### Scenario: Tab filtering is applied
- **WHEN** the seeker selects a status tab
- **THEN** only applications matching that status are shown and tab counters reflect real counts

### Requirement: Row actions SHALL execute valid workflows
The system SHALL wire application-row actions to valid workflows for job viewing, withdrawal, and next-step guidance.

#### Scenario: View Job action
- **WHEN** the seeker selects "View Job"
- **THEN** the system navigates to the matching job detail route

#### Scenario: Withdraw action
- **WHEN** the seeker selects "Withdraw" and confirms
- **THEN** the system updates the application status through an API call and refreshes the row state