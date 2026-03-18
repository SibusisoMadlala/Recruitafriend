## 1. Fix the auth guard

- [x] 1.1 In `src/app/lib/supabase.ts`, extend `isPublicEndpoint()` to return `true` for `POST /auth/signup`
- [x] 1.2 Verify the existing `!canSkipAuthHeader && !isLikelyJwt(token)` guard no longer fires for signup

## 2. Manual smoke test

- [ ] 2.1 Open the app in an incognito browser (no existing session)
- [ ] 2.2 Register a new Job Seeker account — confirm redirect to `/seeker/dashboard`
- [ ] 2.3 Register a new Employer account — confirm redirect to `/employer/dashboard`
- [ ] 2.4 Confirm that attempting a protected action without login (e.g. posting a job as a guest) still throws "Not authenticated"
