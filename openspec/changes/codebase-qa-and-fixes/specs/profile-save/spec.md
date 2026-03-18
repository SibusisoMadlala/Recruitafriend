## ADDED Requirements

### Requirement: ProfileBuilder uses controlled inputs
All input fields in ProfileBuilder SHALL be controlled (value + onChange), populated from `profile` on mount via `react-hook-form` `reset()`, so edits are captured in form state.

#### Scenario: Profile data populates form on load
- **WHEN** a seeker with an existing profile navigates to `/seeker/profile`
- **THEN** all fields (name, phone, headline, summary, etc.) are pre-filled with the current profile values

#### Scenario: User edits a field
- **WHEN** a seeker changes their "Headline" field
- **THEN** the new value is reflected in the input and held in form state

### Requirement: ProfileBuilder saves changes via API
A visible "Save Changes" button in each section SHALL call `PUT /auth/profile` with the current form data, and show success or error feedback via toast.

#### Scenario: Successful save
- **WHEN** a seeker edits their phone number and clicks "Save Changes"
- **THEN** the system calls `PUT /auth/profile`, shows "Profile updated!" toast, and calls `refreshProfile()` to sync `AuthContext`

#### Scenario: API error on save
- **WHEN** the `PUT /auth/profile` request fails
- **THEN** the system shows an error toast with the failure message and does not reset the form

#### Scenario: Loading state during save
- **WHEN** a seeker clicks "Save Changes" and the request is in flight
- **THEN** the "Save Changes" button shows a spinner and is disabled

### Requirement: Profile completion percentage is computed from a shared utility
Both `SeekerLayout` and `ProfileBuilder` SHALL import and use a single `calculateProfileCompletion(profile)` function from `src/app/lib/profileCompletion.ts`.

#### Scenario: Completion updates after save
- **WHEN** a seeker adds their phone number and saves the profile
- **THEN** the completion percentage in the sidebar progress ring updates to reflect the new value without a full page reload
