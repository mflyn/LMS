# Auth Service

This service is a legacy/experimental standalone auth service. It is not the accepted family-growth authentication boundary for Task 1-7.

Accepted family auth currently lives in `backend/services/user-service`:

- parent register/login through `/api/auth/register` and `/api/auth/login`
- child PIN login through `/api/auth/child-pin-login`
- family and child management through `/api/families` and `/api/children`

## Current Local Surface

The standalone auth app mounts `routes/auth.js` under `/api/auth` and exposes `/health`. It has its own user model and tests, but it is not wired as the family MVP source of truth.

## Keep or Remove Decision

Before expanding this service, decide whether the project will keep a separate auth service or continue with `user-service` ownership. Do not add new family auth behavior here unless the architecture baseline is updated first.
