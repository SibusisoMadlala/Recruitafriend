## ADDED Requirements

### Requirement: PostJob form maintains controlled state across steps
All form fields in the PostJob multi-step form SHALL be backed by controlled React state (or `react-hook-form` registration), so that switching between steps does not lose entered data.

#### Scenario: User fills Step 1 and moves to Step 2
- **WHEN** an employer fills in "Job Title" and "Industry" on Step 1 and clicks "Next"
- **THEN** the Step 2 form is shown and the Step 1 values are preserved in state

#### Scenario: User navigates back to Step 1 from Step 2
- **WHEN** an employer on Step 2 clicks "Back"
- **THEN** Step 1 renders with the previously entered values intact

### Requirement: PostJob form validates required fields before advancing
The system SHALL prevent advancing to the next step if required fields on the current step are empty or invalid.

#### Scenario: Required field is empty on step advance attempt
- **WHEN** an employer clicks "Next" on Step 1 without entering a Job Title
- **THEN** the form shows a validation error "Job Title is required" and the step does not advance

### Requirement: PostJob form submits to the API on final step
On Step 4 (Preview & Publish), clicking "Publish Job" SHALL send a `POST /jobs` request with all collected form data, show a success message, and redirect the employer to `/employer/listings`.

#### Scenario: Successful job publish
- **WHEN** an employer completes all steps and clicks "Publish Job" on Step 4
- **THEN** the system calls `POST /jobs` with the form payload, shows a toast "Job posted successfully!", and navigates to `/employer/listings`

#### Scenario: API error on publish
- **WHEN** the `POST /jobs` request returns an error
- **THEN** the system shows a toast with the error message and keeps the user on Step 4

#### Scenario: Loading state during submission
- **WHEN** the employer clicks "Publish Job" and the request is in flight
- **THEN** the button shows a spinner and is disabled to prevent double submission
