## Why

New user registration fails immediately with "Not authenticated" because `apiCall` guards every non-GET HTTP request behind a JWT check, including the `/auth/signup` endpoint — which is called before any user session exists. This blocks all new sign-ups.

## What Changes

- The `isPublicEndpoint` helper in `src/app/lib/supabase.ts` will be extended to allow `POST /auth/signup` without a token.
- The guard that throws `"Not authenticated"` for non-public endpoints will no longer trigger for signup.
- No changes to login, session management, or any other auth flow.

## Capabilities

### New Capabilities

- `registration-auth-guard`: Ensures the `/auth/signup` endpoint is treated as a public (unauthenticated) route in the client-side API call layer, allowing new users to register without a pre-existing session.

### Modified Capabilities

<!-- No existing spec-level behavior is changing. The fix is entirely in the client-side API guard logic. -->

## Impact

- **`src/app/lib/supabase.ts`** — `isPublicEndpoint()` function extended to whitelist `POST /auth/signup`.
- No database, backend (Edge Function), or routing changes required.
- No breaking changes.
