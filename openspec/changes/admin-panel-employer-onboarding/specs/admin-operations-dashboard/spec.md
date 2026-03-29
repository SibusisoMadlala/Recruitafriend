## ADDED Requirements

### Requirement: Admin dashboard SHALL provide onboarding operations statistics
The system SHALL provide admin dashboard metrics for onboarding pipeline health and review performance.

#### Scenario: Admin views onboarding KPI cards
- **WHEN** an admin opens the dashboard
- **THEN** the system displays counts for pending submissions, needs-info submissions, approvals, rejections, and suspended employers for the selected time range

#### Scenario: Admin inspects review latency metrics
- **WHEN** an admin views onboarding performance analytics
- **THEN** the system displays median and percentile review times and highlights SLA breaches for pending backlog items

### Requirement: Admin dashboard SHALL support filterable operational views
The system SHALL allow filtering metrics and queue data by time window and status.

#### Scenario: Admin filters by status and period
- **WHEN** an admin applies status and date filters
- **THEN** dashboard cards and queue tables refresh consistently using the selected filters

### Requirement: Admin dashboard SHALL include actionable trend insights
The system SHALL visualize key trends required for staffing and quality decisions.

#### Scenario: Admin reviews trend chart
- **WHEN** an admin loads trend visuals
- **THEN** the system shows time-series trends for submission volume, decision outcomes, and backlog growth/decline