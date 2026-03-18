## ADDED Requirements

### Requirement: User can request a password reset email
The system SHALL allow a user to enter their registered email address and trigger a Supabase password-reset email that contains a magic link pointing to `/reset-password`.

#### Scenario: Valid email submitted
- **WHEN** a user submits the forgot-password form with an email that exists in auth
- **THEN** the system calls `supabase.auth.resetPasswordForEmail(email)` and shows a success toast "Check your inbox for a reset link"

#### Scenario: Email field is empty
- **WHEN** a user submits the forgot-password form with an empty email field
- **THEN** the form shows a validation error "Email is required" and does not call the Supabase API

#### Scenario: Unknown email submitted
- **WHEN** a user submits the forgot-password form with an email not in auth
- **THEN** the system still shows the success toast (to avoid enumeration attacks) without revealing whether the account exists

### Requirement: User can set a new password via the reset link
The `/reset-password` page SHALL accept the deep-link token from Supabase, present a new-password form, and update the user's password on submission.

#### Scenario: Valid token — new password submitted
- **WHEN** a user lands on `/reset-password` with a valid Supabase recovery token in the URL hash and submits a new password of at least 8 characters
- **THEN** the system calls `supabase.auth.updateUser({ password })`, shows a success toast, and redirects the user to `/login`

#### Scenario: Passwords do not match
- **WHEN** a user submits the reset form with mismatched "New Password" and "Confirm Password" values
- **THEN** the form shows a validation error "Passwords do not match" and does not call the API

#### Scenario: Expired or invalid token
- **WHEN** a user lands on `/reset-password` without a valid token or with an expired token
- **THEN** the page shows an error message "This link is invalid or has expired" with a link back to the forgot-password form
