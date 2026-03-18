## ADDED Requirements

### Requirement: Profiles policy evaluation SHALL be recursion-safe
The system SHALL enforce `public.profiles` read authorization in a way that does not trigger recursive policy evaluation for any valid authenticated access path.

#### Scenario: Authenticated user reads own profile
- **WHEN** an authenticated user queries `public.profiles` for a row where `id = auth.uid()`
- **THEN** the query succeeds without `42P17` and returns the user profile row

#### Scenario: Employer reads applicant seeker profile
- **WHEN** an authenticated employer queries `public.profiles` for a seeker who has applied to one of the employer's jobs
- **THEN** the query succeeds without `42P17` and returns the seeker profile row

#### Scenario: Employer reads unrelated seeker profile
- **WHEN** an authenticated employer queries `public.profiles` for a seeker who has not applied to any of the employer's jobs
- **THEN** access is denied by policy and no profile row is returned

### Requirement: Migration state SHALL converge to a canonical profiles policy end-state
The system SHALL provide a deterministic migration end-state for `public.profiles` SELECT policy objects and any supporting helper function(s), such that environments converge to identical authorization behavior.

#### Scenario: Environment has all change migrations applied
- **WHEN** migration status indicates the recursion-fix change is fully applied
- **THEN** policy/function introspection confirms canonical objects are present with expected names and executable grants

#### Scenario: Migration replay on an already-converged environment
- **WHEN** migration scripts are re-applied in an environment already on the canonical state
- **THEN** migration execution remains idempotent and does not create duplicate or conflicting policy objects

### Requirement: Policy safety SHALL be verifiable operationally
The system SHALL define a verification checklist that proves recursion safety and intended access behavior before the change is considered complete.

#### Scenario: Verification after migration
- **WHEN** operators run the defined post-migration checks
- **THEN** checks confirm (a) no `42P17` in tested profile-read paths and (b) access outcomes match intended self-read and employer-applicant rules

#### Scenario: Verification detects recursion error
- **WHEN** any post-migration check reproduces `42P17`
- **THEN** the rollout is treated as failed verification and requires corrective migration/state alignment before completion
