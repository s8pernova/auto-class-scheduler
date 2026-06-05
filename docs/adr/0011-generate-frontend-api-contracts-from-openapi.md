# ADR 0011: Generate frontend API contracts from OpenAPI

## Status

Accepted

## Date

2026-06-05

## Owners

Aidan Hoo

## Context

The frontend API layer is split by resource, but request and response types can
still drift from FastAPI schemas if they are hand-maintained.

FastAPI already publishes an OpenAPI contract. The frontend can use that
contract to generate TypeScript types and SDK functions, then keep small
hand-written wrappers for app-specific ergonomics.

## Decision

Course Scheduler will generate frontend API contracts from FastAPI OpenAPI
output using `@hey-api/openapi-ts`.

Decision details:

- Export OpenAPI JSON from the local FastAPI app.
- Generate TypeScript types, fetch client support, and SDK functions into
  `ui/src/api/generated`.
- Commit generated TypeScript output so the frontend builds without a running
  backend server.
- Keep human-written resource modules such as `schedules.ts`, `catalogs.ts`,
  and `favorites.ts` as thin wrappers around generated SDK calls.

Out of scope:

- Runtime schema validation.
- TanStack Query hook generation.
- Removing the human-written API wrappers.

## Rationale

OpenAPI generation reduces contract drift and makes backend schema changes
visible at frontend compile time. Keeping wrappers around generated calls avoids
leaking long generated function names throughout product code.

## Consequences

Positive:

- Frontend request and response types come from backend schemas.
- Regeneration is a single npm command.
- Product code imports stable wrapper functions instead of generated names.

Negative:

- Adds generator dependency and generated files to the repo.
- Requires developers to regenerate after backend API changes.

Follow-ups:

- [ ] Add CI drift detection for generated API output.
- [ ] Revisit runtime validators if user-submitted payloads become more complex.
