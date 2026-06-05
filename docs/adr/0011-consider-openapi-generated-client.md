# ADR 0011: Consider OpenAPI-generated frontend API client

## Status

Proposed

## Date

2026-06-05

## Owners

Aidan Hoo

## Context

The frontend currently uses hand-written TypeScript API modules. This is clear
for the current API size, but request and response types can drift from FastAPI
schemas as backend routes evolve.

FastAPI already publishes an OpenAPI contract. A future frontend workflow could
generate TypeScript types, and possibly client functions, from that contract
instead of manually duplicating every API shape.

## Decision

Course Scheduler will keep the current hand-written, resource-split API modules
for now, but will evaluate OpenAPI-generated TypeScript clients before the API
surface grows much larger.

In scope for the future evaluation:

- Generating TypeScript types from FastAPI OpenAPI output.
- Deciding whether generated files are committed or produced in CI.
- Wrapping generated calls with small human-friendly API modules.

Out of scope for now:

- Replacing the current API modules immediately.
- Adding generator tooling to the frontend package.
- Blocking frontend work on generated clients.

## Rationale

OpenAPI generation can reduce contract drift and make backend changes visible at
frontend compile time. It is most useful once there are more routes, more shared
types, or multiple consumers of the API.

For the current MVP, generated-client tooling adds process and dependency weight
before the API surface is large enough to justify it.

## Consequences

Positive:

- Records OpenAPI generation as a serious future option.
- Keeps the current API layer simple while the product shape is still changing.
- Leaves room for generated types plus hand-written ergonomic wrappers.

Negative:

- Frontend types remain hand-maintained for now.
- Backend/frontend contract drift is still possible until generation or contract
  checks are added.

Follow-ups:

- [ ] Compare `openapi-typescript` and `@hey-api/openapi-ts`.
- [ ] Decide whether generated output should be committed.
- [ ] Add a contract-check step if API drift becomes painful.
