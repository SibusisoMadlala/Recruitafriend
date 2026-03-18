## ADDED Requirements

### Requirement: Signup request is permitted without a user session
The system SHALL allow the `POST /auth/signup` client API call to proceed without a valid user JWT, because the user does not yet have a session when registering.

#### Scenario: New user submits registration form
- **WHEN** an unauthenticated visitor submits the signup form with valid email, password, name, and user type
- **THEN** the `apiCall('/auth/signup', { method: 'POST', ... })` call SHALL proceed to the backend without throwing "Not authenticated"

#### Scenario: Signup proceeds even when no session token exists
- **WHEN** `apiCall` is called for `POST /auth/signup` and `supabase.auth.getSession()` returns no session
- **THEN** the call SHALL be forwarded to the server without a user Authorization header (using the anon key only)

#### Scenario: All other POST endpoints remain protected
- **WHEN** `apiCall` is called for any POST endpoint other than `/auth/signup` and there is no valid user JWT
- **THEN** the call SHALL throw `"Not authenticated"` as before
