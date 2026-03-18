## Context

The client-side `apiCall` function in `src/app/lib/supabase.ts` acts as the single gateway for all HTTP requests to the Supabase Edge Function backend. To prevent unauthenticated access to protected endpoints, it validates that a user JWT is present before forwarding any non-public request.

The `isPublicEndpoint()` helper currently whitelists only:
- `GET /stats`
- `GET /jobs`
- `GET /jobs/:id`

All other requests — including `POST /auth/signup` — fall through to a JWT guard that throws `"Not authenticated"`. Since signup is called before any session exists, registration always fails.

## Goals / Non-Goals

**Goals:**
- Allow `POST /auth/signup` to proceed without a user JWT.
- Keep all other non-GET endpoints guarded as before.

**Non-Goals:**
- Changing any server-side (Edge Function) auth logic.
- Modifying the login, session refresh, or sign-out flows.
- Whitelisting any other endpoints.

## Decisions

### Extend `isPublicEndpoint` to cover `POST /auth/signup`

**Decision:** Add an explicit allowlist entry for `POST /auth/signup` inside `isPublicEndpoint()`.

**Alternatives considered:**
- *Remove the method guard entirely* — would open every POST to unauthenticated use; too broad.
- *Add a dedicated `isPublicPost` helper* — unnecessary abstraction for a single endpoint.
- *Pass `requireAuth: false` at call site* — the call site in `AuthContext.tsx` already omits `requireAuth`, but the guard still fires for non-public non-GET endpoints regardless; fixing the call site alone wouldn't work.

**Rationale:** The narrowest possible change. One line added to `isPublicEndpoint`, zero behaviour change elsewhere.

## Risks / Trade-offs

- [Risk: Over-whitelisting] Adding too many public POST entries here could silently expose authenticated routes. → Mitigation: The allowlist will be explicit and reviewed for each new addition; the PR diff makes it visible.
- [Risk: Backend still validates] The Edge Function `/auth/signup` route uses `db.auth.admin.createUser()` with a service-role key — it does not itself require a user JWT, so no backend change is needed.

## Migration Plan

1. Apply one-line change to `isPublicEndpoint` in `src/app/lib/supabase.ts`.
2. Smoke-test: open app in incognito, attempt signup as seeker and employer.
3. Rollback: revert the single line change.
