## 1. Database & Backend Foundation (Supabase Schema)

- [ ] 1.1 Create `supabase/migrations/<timestamp>_init.sql` with `profiles`, `jobs`, `applications`, and `saved_jobs` tables (see design.md for full schema)
- [ ] 1.2 Add RLS `ENABLE ROW LEVEL SECURITY` to all four tables
- [ ] 1.3 Write RLS policies: profiles (owner read/write), jobs (public active-read, employer write), applications (seeker + employer read, seeker insert), saved_jobs (seeker owner)
- [ ] 1.4 Add Postgres trigger `handle_new_user()` on `auth.users` INSERT that inserts a row into `profiles` from `NEW.raw_user_meta_data`
- [ ] 1.5 Run `supabase db push` to apply the migration to the linked project
- [ ] 1.6 Add `GET /employer/stats` route to Edge Function that returns `{ activeListings, totalApplications, shortlisted, interviewsToday, cvViews }` from Postgres queries
- [ ] 1.7 Add `GET /saved-jobs/count` route that returns `{ count }` for the authenticated seeker
- [ ] 1.8 Add `GET /profile/views` route (stub returning 0 is acceptable; field exists in profiles for future tracking)

## 2. Edge Function — Migrate KV to Postgres

- [ ] 2.1 Replace `kv.set / kv.get` in `/auth/signup` with a Postgres upsert to `profiles` (trigger from task 1.4 handles insert; remove manual KV call)
- [ ] 2.2 Replace `kv.get` in `GET /auth/profile` with `SELECT * FROM profiles WHERE id = $userId`
- [ ] 2.3 Replace `kv.*` in `PUT /auth/profile` with `UPDATE profiles SET ... WHERE id = $userId`
- [ ] 2.4 Replace `kv.getByPrefix('job:')` in `GET /jobs` with a Postgres SELECT with filters, add `page` / `limit` offset pagination, and return `totalCount`
- [ ] 2.5 Replace `kv.get('job:' + id)` in `GET /jobs/:id` with a Postgres SELECT + views increment
- [ ] 2.6 Replace `kv.set` in `POST /jobs` with an INSERT into `jobs`
- [ ] 2.7 Replace `kv.*` in `PUT /jobs/:id` and `GET /employer/jobs` with Postgres queries
- [ ] 2.8 Replace `kv.*` in `POST /applications`, `GET /applications/my`, and employer applicant routes with Postgres queries
- [ ] 2.9 Replace `kv.*` in saved-jobs routes (`POST /saved-jobs`, `DELETE /saved-jobs/:id`, `GET /saved-jobs`) with Postgres queries
- [ ] 2.10 Delete `supabase/functions/server/kv_store.tsx` and remove its import from `index.tsx`
- [ ] 2.11 Run `supabase functions deploy server` and smoke-test all endpoints

## 3. Auth & Route Guards

- [ ] 3.1 Create `src/app/components/ProtectedRoute.tsx` — reads `{ user, profile, loading }` from `AuthContext`; if loading shows spinner; if no user redirects to `/login?redirect=<currentPath>`; if role mismatch redirects to the correct dashboard
- [ ] 3.2 Wrap all `/seeker/*` child routes in `routes.ts` with `<ProtectedRoute role="seeker">` element wrappers
- [ ] 3.3 Wrap all `/employer/*` child routes in `routes.ts` with `<ProtectedRoute role="employer">` element wrappers
- [ ] 3.4 Update `Login.tsx` handleSubmit to read `?redirect=` param and navigate there on success
- [ ] 3.5 Remove the manual `useEffect` redirect logic from `SeekerDashboard.tsx` (now handled by `ProtectedRoute`)

## 4. Forgot Password

- [ ] 4.1 Create `src/app/pages/ForgotPassword.tsx` with email input form; on submit call `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })` and show success toast
- [ ] 4.2 Create `src/app/pages/ResetPassword.tsx` that detects the Supabase recovery token in URL hash, shows new-password + confirm-password fields, calls `supabase.auth.updateUser({ password })` on submit, and redirects to `/login` on success
- [ ] 4.3 Add routes `{ path: 'forgot-password', Component: ForgotPassword }` and `{ path: 'reset-password', Component: ResetPassword }` as children of the root `/` layout in `routes.ts`
- [ ] 4.4 Replace the `href="#"` "Forgot password?" anchor in `Login.tsx` with `<Link to="/forgot-password">`

## 5. Navigation Bug Fixes

- [ ] 5.1 In `Navbar.tsx`, change the logo `Link` `to` prop: replace `/seeker/home` with `/seeker/dashboard`
- [ ] 5.2 In `Navbar.tsx`, change the Community nav item `to` prop: replace `/seeker/community` with `/community` for all user types
- [ ] 5.3 In `CommunityBlogs.tsx`, replace the non-functional `<Button>` with `<Link to="/" ...>Back to Home</Link>` styled as a button

## 6. Post Job Form — Wire Up

- [ ] 6.1 Add `react-hook-form` `useForm<PostJobFormValues>()` to `PostJob.tsx` with a TypeScript interface covering all form fields (title, industry, category, employmentType, workLocation, province, city, salaryMin, salaryMax, description, requirements, benefits, interviewType)
- [ ] 6.2 Spread `register('fieldName')` on every `<Input>`, `<Textarea>`, `<Select>` and `<Switch>` in Steps 1–3; pass validation rules for required fields
- [ ] 6.3 Add "Back" button that calls `setStep(step - 1)` on Steps 2–4
- [ ] 6.4 Wrap each "Next" button in `handleSubmit(onNext)` to trigger field-level validation before advancing
- [ ] 6.5 On Step 4 "Publish Job", add an `onSubmit` handler that calls `apiCall('/jobs', { method: 'POST', body: JSON.stringify(formData) })`, shows success toast, and navigates to `/employer/listings`
- [ ] 6.6 Add loading / disabled state to the "Publish Job" button during submission

## 7. Profile Builder — Wire Up

- [ ] 7.1 Create `src/app/lib/profileCompletion.ts` exporting `calculateProfileCompletion(profile: UserProfile): number`; copy the existing logic from `SeekerLayout.tsx` and remove the duplicate in `ProfileBuilder.tsx`
- [ ] 7.2 Update `SeekerLayout.tsx` and `ProfileBuilder.tsx` to import and use `calculateProfileCompletion`
- [ ] 7.3 In `ProfileBuilder.tsx`, add `react-hook-form` `useForm()` with `reset(profile)` in a `useEffect([profile])` so fields pre-populate when profile loads
- [ ] 7.4 Spread `register('fieldName')` on all controlled inputs across Personal, Summary, Work, Education, Skills, and Social sections
- [ ] 7.5 Add a "Save Changes" button per section that calls `apiCall('/auth/profile', { method: 'PUT', body: JSON.stringify(sectionData) })`, shows a toast, and calls `refreshProfile()`
- [ ] 7.6 Add loading and disabled state to each "Save Changes" button during submission

## 8. Employer Dashboard — Load Real Data

- [ ] 8.1 Add a `useEffect` in `EmployerDashboard.tsx` that calls `GET /employer/stats` and `GET /employer/jobs` on mount
- [ ] 8.2 Replace hardcoded `stats` array values with state populated from the API response
- [ ] 8.3 Show a skeleton placeholder in each stat card while data is loading
- [ ] 8.4 Populate `activeListings` and `recentApplicants` state from API responses and render them in their respective tables

## 9. Seeker Dashboard — Load Real Data

- [ ] 9.1 In `SeekerDashboard.tsx` `loadDashboardData()`, also call `GET /saved-jobs/count` and `GET /profile/views`; populate `stats.savedJobs` and `stats.profileViews` from responses
- [ ] 9.2 Replace the hardcoded `"Good morning"` greeting with a `getGreeting()` helper that returns "Good morning", "Good afternoon", or "Good evening" based on `new Date().getHours()`

## 10. Code Quality & Architecture

- [ ] 10.1 Create `src/app/components/ErrorBoundary.tsx` as a React class component with `componentDidCatch` that renders a fallback UI
- [ ] 10.2 Wrap `<RouterProvider>` in `App.tsx` with `<ErrorBoundary>`
- [ ] 10.3 Create `src/app/types/index.ts` with interfaces `Job`, `Application`, `SavedJob`, `UserProfile` (expanded); replace all `any[]` / `any` usage in pages and context with these types
- [ ] 10.4 Find all inline hex colour values (`#00C853`, `#0A2540`, `#00B548`, `#1a3a5f`) across all `.tsx` files and replace with the corresponding CSS variable (`var(--rf-green)`, `var(--rf-navy)`, etc.)
- [ ] 10.5 Rename `package.json` `name` field from `@figma/my-make-file` to `recruitfriend-web`
- [ ] 10.6 Fix `AuthContext.tsx` — ensure `setLoading(false)` is also called inside the `onAuthStateChange` callback (currently only in the initial `getSession` callback), preventing a subtle loading-state inconsistency
