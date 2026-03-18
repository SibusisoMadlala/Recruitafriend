## ADDED Requirements

### Requirement: EmployerDashboard loads real stats on mount
The `EmployerDashboard` page SHALL call the API on mount to fetch: count of active job listings, total applications received, shortlisted candidates, interviews scheduled today, and total CV views. It SHALL replace the hardcoded `"0"` values with these real figures.

#### Scenario: Stats load successfully
- **WHEN** an employer navigates to `/employer/dashboard`
- **THEN** the stats cards display accurate counts fetched from `GET /employer/stats`

#### Scenario: Stats load while data is fetching
- **WHEN** the employer dashboard is mounted and the API call is in flight
- **THEN** each stat card shows a skeleton loader in place of the numeric value

#### Scenario: API error on stats load
- **WHEN** `GET /employer/stats` returns an error
- **THEN** the stats cards display "–" and a subtle error message is shown

### Requirement: EmployerDashboard loads recent applicants and active listings
The dashboard SHALL fetch and render the 5 most recent applications and up to 5 active job listings from the API.

#### Scenario: Active listings are displayed
- **WHEN** an employer has active job listings
- **THEN** the "Active Listings" table shows up to 5 listings with title, application count, views, and status

#### Scenario: No active listings
- **WHEN** an employer has no active job listings
- **THEN** the empty state renders with a "Post your first job" call-to-action link

### Requirement: SeekerDashboard loads saved-job count and profile-view count
The `SeekerDashboard` SHALL call `GET /saved-jobs/count` and `GET /profile/views` on mount so `stats.savedJobs` and `stats.profileViews` show real values instead of `0`.

#### Scenario: Saved jobs count is loaded
- **WHEN** a seeker with 3 saved jobs visits the dashboard
- **THEN** the "Saved Jobs" stat card shows `3`

### Requirement: SeekerDashboard greeting is time-of-day-aware
The welcome banner greeting SHALL use "Good morning", "Good afternoon", or "Good evening" based on the user's local time.

#### Scenario: Morning greeting
- **WHEN** a seeker visits the dashboard between 05:00 and 11:59
- **THEN** the banner reads "Good morning, <name>!"

#### Scenario: Afternoon greeting
- **WHEN** a seeker visits the dashboard between 12:00 and 17:59
- **THEN** the banner reads "Good afternoon, <name>!"

#### Scenario: Evening greeting
- **WHEN** a seeker visits the dashboard at 18:00 or later
- **THEN** the banner reads "Good evening, <name>!"
