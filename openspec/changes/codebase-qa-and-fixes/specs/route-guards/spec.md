## ADDED Requirements

### Requirement: Unauthenticated users are redirected to login
The system SHALL redirect any user who accesses a `/seeker/*` or `/employer/*` route without a valid auth session to `/login`, preserving the intended destination as a `?redirect=` query param so the user can be sent there after signing in.

#### Scenario: Unauthenticated access to seeker dashboard
- **WHEN** a visitor navigates directly to `/seeker/dashboard`
- **THEN** the system redirects them to `/login?redirect=/seeker/dashboard`

#### Scenario: Unauthenticated access to employer dashboard
- **WHEN** a visitor navigates directly to `/employer/dashboard`
- **THEN** the system redirects them to `/login?redirect=/employer/dashboard`

#### Scenario: Authenticated user is not redirected
- **WHEN** a seeker with a valid session navigates to `/seeker/dashboard`
- **THEN** the dashboard renders without redirection

### Requirement: Role mismatch is rejected
The system SHALL prevent a user whose `profile.userType` is `seeker` from accessing any `/employer/*` route, and vice versa, redirecting them to their own dashboard.

#### Scenario: Seeker accesses employer route
- **WHEN** an authenticated seeker navigates to `/employer/dashboard`
- **THEN** the system redirects them to `/seeker/dashboard`

#### Scenario: Employer accesses seeker route
- **WHEN** an authenticated employer navigates to `/seeker/dashboard`
- **THEN** the system redirects them to `/employer/dashboard`

### Requirement: Post-login redirect is honoured
After a successful sign-in, if a `redirect` query param is present, the system SHALL navigate the user to that path instead of the default dashboard.

#### Scenario: Redirect param is present after login
- **WHEN** a user signs in from `/login?redirect=/seeker/profile`
- **THEN** the system navigates them to `/seeker/profile`

#### Scenario: No redirect param defaults to dashboard
- **WHEN** a user signs in from `/login` with no redirect param
- **THEN** the system navigates them to their role-appropriate dashboard
