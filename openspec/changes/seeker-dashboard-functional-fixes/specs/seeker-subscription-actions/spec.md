## ADDED Requirements

### Requirement: Subscription controls SHALL trigger valid plan workflows
The system SHALL make seeker subscription controls functional for plan selection and trial-start actions, with clear current-plan handling.

#### Scenario: Select non-current plan
- **WHEN** the seeker clicks a selectable plan action
- **THEN** the system initiates the plan-change workflow and surfaces success or failure state

#### Scenario: Current plan is protected
- **WHEN** the displayed plan matches the seeker’s current plan
- **THEN** the action remains disabled and clearly labeled as current

### Requirement: Trial CTA SHALL be actionable
The system SHALL make the free-trial CTA start a valid trial flow or display an explicit unavailability reason.

#### Scenario: Start trial
- **WHEN** the seeker clicks "Start Free Trial"
- **THEN** the system starts trial activation or redirects to the configured billing/trial entry point