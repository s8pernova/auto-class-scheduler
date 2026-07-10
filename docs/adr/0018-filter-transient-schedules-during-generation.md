# ADR 0018: Filter generated schedules with Redis-backed search sessions

## Status

Accepted

## Implementation

State: Implemented

Evidence:

- [x] Redis-backed sessions store the complete bounded generated universe with
      fixed TTL, payload-size, result-count, namespace, and schema-version
      controls.
- [x] Session creation and result queries require a Supabase user scope and
      reject cross-scope access without disclosing session existence.
- [x] Typed day, blocked-time, time-window, meeting-day, gap, and instructor-
      rating filters run across the complete cached universe.
- [x] Every declared sort runs deterministically before opaque-cursor
      pagination, with missing ratings last and a stable section-ID tie-breaker.
- [x] Responses expose expiry, candidate/generated/filtered/returned counts,
      next cursor, authoritative summary metrics, and hydrated catalog rows.
- [x] The results UI retains view state, applies server-side controls, keeps
      successful results visible while loading, loads additional pages, and
      offers one-click regeneration after expiry.
- [x] Backend and frontend tests cover filters, boundaries, gap calculations,
      rating policy, sorts, cursors, ownership, request construction, state
      retention, pagination, counts, and expiry messaging.
- [x] The superseded `preferences`, `maxResults`, `validCount`, offset paging,
      `/schedules/generate`, and client-only production filter/sort paths were
      removed from code, generated contracts, tests, and current documentation.

Last checked: 2026-07-10

## Date

2026-06-24

## Owners

Aidan Hoo

## Context

Course Scheduler stores catalogs and candidate sections permanently. Generated
schedule options are derived data: they can be recreated from catalog sections,
requirements, and ratings, and can grow much faster than the source catalog.
Only a schedule selected as a favorite becomes durable user-owned state.

The first results-page prototype filters and sorts the schedules already
returned to the browser. That is fast and simple, but the generation endpoint
caps its response with `maxResults`. If 2,000 schedules match and the API
returns the first 100, filtering those 100 does not search the other 1,900.
Likewise, sorting those 100 by earliest start does not prove that they are the
globally earliest 100 schedules.

The absence of permanent result rows does not require the app to move filtering
back into SQL, nor does it require rerunning the full generator on every filter
change. SQL remains the right tool for loading persisted candidate sections and
querying saved schedules. The combinatorial scheduling problem is application
logic: the generator creates candidate combinations, rejects time conflicts,
computes summaries, and stores a compact, expiring result universe for the
current search session.

ADR 0004 defers weighted ranking but explicitly allows hard filters and
single-field sorting. This ADR defines how those filters and sorts work without
turning them into hidden ranking. ADR 0016 continues to defer campus, location,
modality, and travel filters until the catalog has reliable structured data for
them.

The product needs true filtering, sorting, and pagination over the complete
generated result universe for a search. This is especially important while
weighted ranking is deferred: filters and sorts are the user's primary way to
explore hundreds of valid options.

Constraints:

- Generated schedules remain non-durable unless the user favorites one.
- The API must enforce `maxCandidateCombinations`, the complete generation-
  session result and encoded-size limits, and the result-page size limit.
- A generation session that exceeds its complete-universe result or encoded-
  size limit must be rejected with guidance to narrow the request. It must not
  be silently truncated and then presented as exhaustively filterable.
- A filter presented as exhaustive must apply to the complete candidate search,
  not only the browser's returned subset.
- Users must be able to page through the remaining matching schedules without
  regenerating the same search universe.
- Manual catalog entry currently provides meeting days, times, instructors, and
  transient instructor ratings, but not reliable seats, modality, or location.
- Filter behavior must be deterministic, validated, and testable independently
  of the UI.

Assumptions:

- Current catalog sizes remain within the configured bounded candidate limit.
- Redis is acceptable project infrastructure for this feature and for learning
  cache/session patterns.
- Users expect filters to exclude schedules, while sorts only change their
  order.
- Users benefit more from explicit constraints than from an unexplained
  weighted score.

## Decision

Course Scheduler will generate a bounded schedule universe once for a stable
search request, store compact generated-result summaries in Redis as an
expiring generation session, and apply typed filters, deterministic sorting,
and pagination against that cached session. It will not permanently persist
every generated schedule merely to query the results with SQL.

Decision details:

- Keep normalized candidate sections and saved favorites in PostgreSQL.
- Keep ordinary generated options transient in Redis with a configured TTL.
- Store compact cached results, not duplicated catalog payloads: selected
  `catalog_section_meetings` IDs plus computed summary/filter/sort fields.
- Store compact candidate facts once per session, keyed by
  `catalog_section_meeting_id`, so filters can inspect exact meeting intervals
  and transient instructor ratings without duplicating those facts in every
  generated result.
- Hydrate display details from PostgreSQL section and meeting rows when
  returning a result page.
- Treat requirement satisfaction and collision detection as base validity.
- Treat the initial catalog, requirement groups, required/excluded sections,
  and instructor-rating map as search-universe inputs. Changing these creates
  or reuses a generation session keyed by the normalized input.
- Treat day, time, gap, instructor-rating threshold, sort, and page controls as
  view filters over the cached session when they can be evaluated from cached
  summary fields.
- Apply filters across all cached session results before pagination so a
  matching schedule cannot be hidden behind an arbitrary earlier slice.
- Apply deterministic sort across all filtered session results before
  pagination; always include a stable tie-breaker derived from selected catalog
  section IDs.
- Return counts that distinguish the full generated session, the filtered
  match count, and the current page size.
- Do not use browser-only filters for authoritative result claims.
- Keep filters, sorting, and future weighted ranking as separate concepts:
  filters exclude, sorting orders by one declared field, and ranking combines
  multiple weighted preferences.
- Add Redis infrastructure/configuration for local development and deployment.
  No PostgreSQL migration is required for the generation cache itself.

Initial cached-session filters, using currently reliable data:

- `excludedDays`: weekdays on which no meeting may occur.
- `blockedTimes`: day-specific time ranges no meeting may overlap; this already
  exists and remains the flexible escape hatch.
- `notBefore`: reject schedules containing a meeting that starts before this
  time.
- `notAfter`: reject schedules containing a meeting that ends after this time.
- `maxMeetingDays`: maximum number of distinct meeting days.
- `maxTotalGapMinutes`: maximum total idle time between meetings on the same
  day.
- `maxSingleGapMinutes`: maximum single idle gap between consecutive meetings
  on the same day.
- `minimumInstructorRating`: minimum rating for every rated instructor in the
  schedule.
- `allowUnratedInstructors`: explicit policy for sections whose instructor has
  no rating; it defaults to `true` so missing external data does not silently
  eliminate valid schedules.

Initial sorts:

- Earliest start, ascending or descending.
- Latest end, ascending or descending.
- Number of meeting days, ascending or descending.
- Total gap minutes, ascending or descending.
- Average instructor rating, ascending or descending, with unrated schedules
  placed last by default.

In scope:

- Redis-backed generation sessions with TTL cleanup.
- Server-side generated-schedule filters, sorts, and pagination over cached
  sessions.
- Backend request types, validation, metrics, and evaluation order.
- Results-page controls and accurate result counts.
- A generator structure that can later adopt pruning without changing the API
  semantics.

Out of scope:

- Weighted or personalized multi-factor ranking.
- Permanently persisting all generated options.
- Filtering the separate saved-schedule list API.
- Campus, building, room, modality, seat, restriction, or travel filters before
  those fields have authoritative structured data.
- A background generation job, distributed solver, or PostgreSQL
  generated-results table.

## Rationale

Redis-backed generation sessions provide correct answers without creating a
large permanent result table or rerunning the generator for every UI filter
change. The source data already lives in PostgreSQL; generated combinations do
not become durable product records simply because the UI needs to page, filter,
and sort them for a short time.

This division follows the data lifecycle:

- PostgreSQL retrieves durable facts and user-owned saved state.
- The generator solves a bounded combinatorial problem over those facts for a
  stable search universe.
- Redis stores the compact temporary result universe for that search session.
- The API filters, sorts, paginates, and hydrates result pages from that
  temporary universe.
- PostgreSQL persists only an explicitly selected favorite.

Applying filters before pagination prevents false negatives. Applying sort
before pagination prevents a locally sorted arbitrary slice from being
presented as the global order. Keeping filter predicates and metric functions
pure makes them straightforward to unit test and later reuse in a backtracking
or constraint-programming engine.

The current implementation materializes combinations and then filters them.
That is acceptable under the enforced MVP candidate limit, but it is not the
long-term scaling strategy. The next professional optimization is incremental
backtracking: reject partial schedules as soon as they conflict with another
meeting or make a constraint impossible. If catalogs outgrow that approach, a
constraint solver such as CP-SAT is a better fit than permanently inserting
every Cartesian combination into SQL. Redis remains a session cache around the
result universe, not the authoritative scheduling engine.

## Design and implementation notes

### Data model

- No PostgreSQL migration is required for generation sessions.
- Catalog sections and meetings remain the durable generation inputs.
- `saved_schedules` and related rows remain the durable representation of a
  user-selected result.
- Ordinary generated schedules are not inserted into a permanent results table.
- Redis stores generation-session metadata and compact result rows with a TTL.
- A cached generation session contains candidate facts needed to evaluate
  filters without reloading every candidate from PostgreSQL:
  - `catalogSectionMeetingId`
  - exact meeting day/start/end intervals
  - transient instructor rating, when supplied
- Cached result rows contain only fields needed to filter, sort, page, and
  later hydrate details:
  - stable result key / index
  - selected `catalog_section_meetings` IDs
  - meeting days and day count
  - earliest start and latest end
  - total gap minutes and maximum single gap
  - average instructor rating and rated/unrated counts
  - campus/modality fields later, once authoritative source data exists
- Cache keys must include a normalized search-universe fingerprint, catalog
  identity, catalog version or update marker, app algorithm version, and user
  identity or access scope.
- Redis TTL must be short-lived and configurable. Expiry is the cleanup
  mechanism; stale or missing sessions regenerate or return a clear expired
  session response.
- `blockedTimes` is evaluated against the session-level exact meeting
  intervals. Overall earliest/latest bounds are not sufficient because a
  blocked range may fall inside an otherwise idle gap.

### Initial operational limits

Use these initial values until production measurements justify changing them:

- Generation-session TTL: 30 minutes (`1,800` seconds).
- Result-page default size: `50` schedules.
- Result-page maximum size: `100` schedules.
- Complete generation-session result limit: `10,000` schedules.
- Maximum encoded generation-session payload: `16 MiB`.
- Cache namespace and schema version: `course-scheduler:v1`.

The session TTL is fixed from creation and is not refreshed by result-page
reads. This keeps memory use predictable and prevents abandoned browser tabs
from retaining sessions indefinitely. An expired or evicted session returns a
clear expired-session response and can be regenerated.

The complete-session result and byte limits are safety limits, not pagination
limits. If either is exceeded, the backend rejects the generation request and
asks the user to narrow the search. It must never cache only the first portion
of the generated universe because filters and global sorts would no longer be
authoritative.

The existing request-level `maxResults` field is replaced by `page.limit`.
`page.limit` controls only the current response size and never limits the
complete generated universe stored in the session.

### API / interfaces

`POST /api/v1/schedule-generation-sessions` creates or reuses a cached
generation session for the stable search universe. It returns session metadata
and the first result page. The intended request shape is:

```json
{
  "metadata": {
    "catalogId": "00000000-0000-0000-0000-000000000000"
  },
  "requirements": {
    "groups": []
  },
  "filters": {
    "excludedDays": ["F"],
    "blockedTimes": [
      {
        "days": "MW",
        "startTime": "12:00",
        "endTime": "14:00"
      }
    ],
    "notBefore": "09:00",
    "notAfter": "18:00",
    "maxMeetingDays": 4,
    "maxTotalGapMinutes": 180,
    "maxSingleGapMinutes": 90,
    "minimumInstructorRating": 3.0,
    "allowUnratedInstructors": true
  },
  "instructorRatings": {
    "Smith": 4.6
  },
  "sort": {
    "field": "totalGapMinutes",
    "direction": "asc"
  },
  "page": {
    "limit": 50
  }
}
```

`POST /api/v1/schedule-generation-sessions/{sessionId}/results` returns
additional filtered, sorted, paginated results from the cached session. A POST
body keeps structured blocked-time filters typed and avoids encoding nested
ranges into a query string:

```json
{
  "filters": {
    "excludedDays": ["F"]
  },
  "sort": {
    "field": "totalGapMinutes",
    "direction": "asc"
  },
  "page": {
    "limit": 100,
    "cursor": "opaque-cursor"
  }
}
```

During implementation, replace the current broad `preferences` container with
explicit `filters`, `instructorRatings`, `sort`, and `page` fields. This is an
internal API with generated frontend contracts, so the transition should update
all consumers and remove the superseded request shape rather than preserve a
compatibility alias without a verified consumer.

The generated response should expose one authoritative summary structure:

```json
{
  "sessionId": "schedgen_...",
  "expiresAt": "2026-06-25T18:00:00Z",
  "candidateCount": 2400,
  "generatedCount": 516,
  "filteredCount": 430,
  "returnedCount": 100,
  "nextCursor": "opaque-cursor",
  "schedules": [
    {
      "resultId": "<deterministic selected-section key>",
      "summary": {
        "meetingDays": ["M", "W", "R"],
        "numMeetingDays": 3,
        "earliestStart": "09:30",
        "latestEnd": "16:15",
        "totalGapMinutes": 75,
        "maxSingleGapMinutes": 45,
        "averageInstructorRating": 4.2,
        "ratedInstructorCount": 3,
        "unratedInstructorCount": 1
      },
      "sections": []
    }
  ]
}
```

Count semantics:

- `candidateCount`: combinations considered before collision and user
  filter checks.
- `generatedCount`: schedules satisfying requirements and collision rules for
  the cached search universe.
- `filteredCount`: cached session results satisfying the requested filters.
- `returnedCount`: schedules included on the current page after deterministic
  sorting and pagination.
- `nextCursor`: opaque cursor for the next page, or `null` when no more
  filtered results remain.

The backend should represent filters and summary metrics with typed models,
not dictionaries passed across layers. Shared pure functions should calculate
meeting-day sets, time bounds, gap metrics, and instructor-rating coverage once
per schedule.

### Generator and session evaluation order

For session creation:

1. Load candidate sections from PostgreSQL.
2. Resolve requirement groups and validate safety limits.
3. Normalize the search-universe inputs and compute a session fingerprint.
4. Reuse an unexpired Redis session when the fingerprint and access scope
   match.
5. Enumerate combinations when no usable session exists.
6. Reject duplicate courses or sections.
7. Reject meeting collisions.
8. Compute the summary once for each remaining schedule.
9. Store compact candidate facts and result rows in Redis with TTL.
10. Return the first filtered, sorted page.

For result-page reads:

1. Validate the session exists, has not expired, and belongs to the requesting
   user/access scope.
2. Normalize and validate filters, sort, limit, and cursor.
3. Evaluate filters across the complete cached result universe.
4. Count the filtered matches.
5. Sort with a deterministic tie-breaker.
6. Page with an opaque cursor.
7. Hydrate selected section details from PostgreSQL.
8. Return the page and next cursor.

The next performance refactor should replace full Cartesian materialization
with backtracking and early pruning while preserving these externally visible
semantics. Redis does not remove the need for generator safety limits; it makes
the generated universe reusable for filter, sort, and pagination interactions.

### Frontend behavior

- Present exhaustive controls as server-side filters over the active generation
  session, preferably with an explicit **Apply filters** action to avoid a
  request on every keystroke.
- Keep the last successful results visible while a new request is loading.
- Display `generatedCount`, `filteredCount`, `returnedCount`, and whether more
  pages are available.
- Do not say “0 schedules match” after filtering only a truncated browser
  subset.
- Provide pagination or **Load more** when `nextCursor` is present.
- Store the active generation session, filters, sort, and cursor state with
  the catalog draft so navigating between the request and results steps does
  not silently reset it.
- Handle expired sessions explicitly by offering to regenerate.
- Generate TypeScript contracts from OpenAPI after backend schema changes; do
  not hand-maintain duplicate API interfaces.

### Security and privacy

- Generation filters and transient results are scoped to the authenticated
  user/access context and expire automatically.
- Catalog access continues through the existing authenticated and RLS-protected
  catalog lookup.
- Instructor ratings supplied for generation remain transient unless a
  separate accepted decision defines durable enrichment storage.
- Server-side validation and configured size limits remain authoritative; UI
  limits are only usability aids.
- Redis keys must not expose raw user IDs, emails, catalog names, or full
  request payloads. Use opaque IDs and hashes for externally visible values.
- Do not log selected section lists or instructor-rating maps in normal
  request logs.

### Operations

- Configure Redis URL, the initial operational limits above, and cache
  namespace/schema version per environment. Production may override capacity
  values only from measured workload and available Redis memory.
- Log generation duration, cache hit/miss, candidate count, generated count,
  filtered count, returned count, active filter names, and page size. Do not
  log entire user catalogs, selected section arrays, or instructor-rating maps.
- Measure before adding background jobs or a solver service.
- Continue rejecting requests above `maxCandidateCombinations` until pruning or
  solver work demonstrates a safe higher bound.
- Redis TTL is the cleanup mechanism. If a Redis deployment requires active
  memory management, set eviction policy and key namespace deliberately rather
  than relying on broad shared defaults.

## Consequences

Positive:

- Filters remain correct even when more valid schedules exist than the page
  size.
- Users can page through the complete filtered result set for an active
  session.
- Filter and sort changes reuse the cached generated universe instead of
  rerunning the generator every time.
- The API clearly distinguishes filtering, sorting, and future ranking.
- Pure filter and metric logic can be tested without a database or browser.
- The architecture can evolve from bounded enumeration to pruned search without
  changing product semantics.

Negative:

- Redis becomes required infrastructure for this feature in non-trivial
  environments.
- Session expiry must be handled in the UI and API.
- Cached result schemas need versioning/invalidation when summary algorithms
  change.
- More backend code is needed for session keys, TTLs, pagination cursors, and
  hydration.
- Changing search-universe inputs still requires a new generation session.
- Correct global sorting may require scanning all bounded candidates.
- Additional summary metrics add backend computation.
- The current request and response contracts require a deliberate breaking
  refactor across backend schemas, generated clients, fixtures, and UI code.
- Instructor-rating filters require explicit missing-data semantics.

Follow-ups:

- [x] Add Redis configuration using the initial operational limits, local
      development service wiring, and production deployment documentation.
- [x] Add typed filter, sort, and pagination schemas with validation and
      limits.
- [x] Implement session fingerprinting, TTL, ownership/access checks, and
      cache-version invalidation.
- [x] Implement pure summary-metric and filter-predicate functions.
- [x] Store compact generated result summaries in Redis and hydrate returned
      pages from PostgreSQL.
- [x] Apply filters and sorting before pagination.
- [x] Add `sessionId`, `expiresAt`, `generatedCount`, `filteredCount`,
      `returnedCount`, `nextCursor`, and the authoritative summary object to
      generated responses.
- [x] Regenerate the OpenAPI TypeScript client and update all consumers.
- [x] Replace the prototype `dayFilter` with server-side filter controls.
- [x] Add backend unit tests for every filter, boundary time, gap
      calculation, missing rating policy, sorting tie-breaker, session expiry,
      and pagination.
- [x] Add frontend tests for request construction, counts, expired-session
      messaging, pagination, and filter state retention.
- [x] Update `docs/api/schedule-generation.md` with the final implementation.
- [ ] Profile generation before selecting backtracking, top-k selection, or a
      constraint solver. This remains a separate performance follow-up and does
      not change the implemented API semantics.

## Alternatives considered

1. Persist every generated schedule permanently and filter it with SQL
   - Why not: Generated combinations are high-volume derived data with a short
     lifetime. Persistence adds inserts, indexes, ownership rules, cleanup,
     invalidation, and storage cost without improving the scheduling algorithm.

2. Filter and sort only in the browser
   - Why not: This is correct only when the API returns every valid schedule.
     Once results are capped, it can hide matching schedules and misrepresent
     an arbitrary subset as the global sort order.

3. Add filter query parameters to the saved-schedule list endpoint
   - Why not: Saved schedules and transient generated options have different
     lifecycles. Reusing the saved-list SQL path would conflate two separate
     products and still require generated options to be stored.

4. Return every valid schedule to the browser
   - Why not: Response size, rendering work, and client memory grow with the
     Cartesian product and bypass the purpose of `maxResults`.

5. Adopt a full constraint solver immediately
   - Why not: The current safety limit makes deterministic application-level
     enumeration viable. Pure typed filters and metrics should be built
     first so a later engine replacement has stable semantics and tests.

6. Use weighted ranking for all preferences
   - Why not: A ranking score does not enforce hard exclusions and reintroduces
     the subjective behavior deferred by ADR 0004.

7. Rerun generation for every filter change
   - Why not: It is simple, but it wastes compute, makes pagination awkward,
     and creates a worse learning surface for the cache/session model we want
     to adopt.

8. Use PostgreSQL temporary generated-results tables instead of Redis
   - Why not: This is operationally valid, but Redis better matches the
     short-lived session-cache lifecycle and is the infrastructure this project
     intentionally wants to learn here.

## Rollout plan

1. Add tests that expose the current truncation-before-client-filter problem.
2. Add Redis configuration and local development wiring without changing the
   public schedule-generation behavior yet.
3. Introduce typed filter, sort, pagination, and schedule-summary models.
4. Implement session fingerprinting, compact Redis result storage, TTL, and
   ownership/access validation.
5. Move existing blocked-time behavior into the authoritative filter evaluator
   without changing its semantics.
6. Add day, time-window, meeting-day-count, gap, and instructor-rating filters
   one at a time with unit tests.
7. Compute summaries once, sort the complete filtered session
   deterministically, and paginate only after sorting.
8. Regenerate the frontend API client and update fixtures and draft state.
9. Replace the client-only weekday filter with server-backed filter controls;
   delete the superseded filter path.
10. Add accurate count, pagination, and expired-session messaging and verify
    the full flow.
11. Profile realistic catalogs and create a separate performance ADR only if
    measurements justify backtracking, solver, or background-job
    infrastructure.

## Resolved implementation questions

- `generatedCount` means base collision-free schedules and `filteredCount`
  means schedules remaining after the requested filters; `validCount` was
  removed.
- Global `notBefore` and `notAfter` bounds coexist with day-specific
  `blockedTimes` for exceptions.
- `allowUnratedInstructors` remains an explicit filter and defaults to `true`.
- The initial TTL is 30 minutes with fixed, non-refreshing expiration.
- Session creation remains synchronous under the candidate and payload limits;
  background generation requires separate measured justification.
