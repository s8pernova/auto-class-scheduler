# ADR 0001: Generate schedules on demand instead of storing every permutation

## Status

Accepted

## Date

2026-05-18

## Owners

Aidan Hoo

## Context

The scheduler is moving from a single-user experiment into a multi-user, multi-school product. The existing database can store generated schedules through `schedules` and `schedule_sections`, and users can favorite a stored schedule through `favorites`. The catalog data currently lives in `possible_classes`, with school scoping added through `school_id`.

The core design question is whether every possible schedule permutation should be inserted into the database ahead of time, or whether schedules should be generated when a user searches.

Constraints:

- The product should support multiple schools, terms, users, and course sets.
- The database should stay small enough to run cheaply on Supabase.
- Searches should return useful schedules without forcing the system to precompute every possible combination.
- User-owned data must stay separate from public catalog data.
- The design should allow caching later without making cache data the source of truth.

Assumptions:

- Most generated schedule permutations will never be viewed, favorited, exported, or shared.
- Course catalog and section data changes less often than user searches.
- Different users may search the same school, term, and courses with different filters.
- The first version can generate schedules synchronously from indexed catalog tables.
- If search volume grows, the system can add a bounded search cache with expiration.

## Decision

The scheduler will not permanently store every possible schedule permutation. The database will store school, term, course, section, meeting, restriction, and user-owned saved schedule data. Schedule permutations will be generated on demand from catalog data when a user searches. A generated schedule will only be persisted when the user takes an explicit action such as saving, favoriting, exporting, or sharing it. Search result caching may be added later as an optimization, but cache rows will be temporary and will not be treated as canonical schedule data.

Decision details:

- Treat catalog data as the source of truth.
- Treat generated schedules as derived data.
- Persist only user-selected schedules.
- Reject invalid combinations during generation instead of generating all combinations first.
- Add search caching only after repeated search traffic justifies it.
- Include `algorithm_version` and `catalog_version` in any future cache key.

In scope:

- Whether schedule permutations are stored permanently.
- How generated schedules relate to catalog data.
- How favorites and saved schedules should work.
- The first-pass architecture for search generation and future caching.

Out of scope:

- The exact schedule scoring formula.
- The final normalized catalog schema.
- Real-time seat availability refresh.
- Third-party school data ingestion.
- UI ranking and filtering controls.

## Rationale

This decision keeps the database focused on durable business data instead of filling it with derived permutations.

- Precomputing every permutation grows badly as schools, terms, courses, and users increase.
- Most generated combinations are invalid or useless because of time conflicts, section restrictions, campus filters, full sections, or user preferences.
- On-demand generation allows the scheduler to prune bad paths early.
- Saving only user-selected schedules keeps `favorites` and saved schedules meaningful.
- Temporary caching can still give faster repeat searches without making cache entries part of the permanent data model.
- The current schema already separates public catalog reads from user-owned favorite writes, which fits this decision.

## Design and implementation notes

### Data model

Current tables:

- `schools`: canonical school lookup table.
- `possible_classes`: current catalog and meeting source table.
- `schedules`: should represent saved or materialized schedules, not every possible generated schedule.
- `schedule_sections`: should store the selected sections for saved or materialized schedules.
- `favorites`: should store a user's relationship to a saved or materialized schedule.

Recommended future tables:

- `terms`: school-scoped academic terms.
- `courses`: canonical course identity per school.
- `sections`: one row per CRN or class section.
- `section_meetings`: one row per meeting block for a section.
- `section_restrictions`: structured rules used to reject ineligible sections.
- `saved_schedules`: user-owned schedules that were explicitly saved.
- `saved_schedule_sections`: selected section IDs for a saved schedule.

Indexes:

- `possible_classes(school_id, term_name, subject_code, course_number, course_suffix)`: supports finding candidate sections by selected courses.
- `possible_classes(school_id, term_name, crn)`: supports lookup by CRN.
- Future `section_meetings(section_id, day_of_week, start_time, end_time)`: supports conflict checks.
- Future `saved_schedules(user_id, school_id, term_id, created_at)`: supports loading a user's saved schedules.
- Future unique schedule fingerprint index on `(user_id, school_id, term_id, schedule_hash)`: prevents duplicate saves for the same user.

### Generation algorithm

The search service should:

1. Load candidate sections for the requested school, term, and course list.
2. Group candidates by requested course.
3. Sort courses by fewest valid candidates first.
4. Recursively choose one section per course.
5. Reject a partial schedule immediately if the next section creates a time conflict.
6. Reject a section if hard restrictions fail.
7. Track derived metrics as the schedule is built.
8. Return the best N schedules after filtering and scoring.
9. Persist nothing unless the user saves, favorites, exports, or shares a schedule.

Derived metrics may include:

- `total_credits`
- `num_sections`
- `num_days_on_campus`
- `earliest_start`
- `latest_end`
- `campus_pattern`
- day flags
- instructor score
- gap time
- online versus in-person count

### API / interfaces

Suggested endpoints:

- `POST /schedule-searches`: generates schedules for a school, term, course list, and filters.
- `POST /saved-schedules`: saves one generated schedule.
- `GET /saved-schedules`: lists the current user's saved schedules.
- `DELETE /saved-schedules/:id`: deletes a saved schedule.
- `POST /favorites`: marks a saved schedule as favorited.
- `DELETE /favorites/:id`: removes a favorite.

Suggested service boundary:

- `generate_schedules(input)`: pure generation function with no database writes.
- `save_schedule(user_id, generated_schedule)`: write path for user-selected schedules.
- `score_schedule(schedule, preferences)`: ranking function.

### Security and privacy

Access rules:

- Catalog tables stay readable by anonymous and authenticated users.
- User-owned saved schedules are readable and writable only by the owning user.
- User-owned favorites are readable and writable only by the owning user.
- Future cache rows should not contain private user details unless scoped by `user_id` and protected by RLS.

Data handling:

- Store public catalog facts.
- Store user-saved schedules.
- Store favorites.
- Store user preferences only if needed for repeat use.
- Do not store every generated schedule.
- Do not store rejected schedule combinations.
- Do not store search results permanently by default.

### Operations

Scheduling / runtime:

- No background permutation builder is needed for the first version.
- Schedule generation runs at request time.
- A later cache cleanup job may delete expired search cache rows.

Observability:

- Logs should record search duration, requested course count, candidate section count, generated valid count, returned count, and pruning counts.
- Metrics should track p50, p95, and p99 search latency.
- Metrics should track how often users save or favorite returned schedules.
- Alerts should fire if search latency or error rate crosses the chosen threshold.

## Consequences

Positive:

- Database growth stays controlled.
- Search behavior can adapt to each user's filters.
- The system avoids storing millions of unused permutations.
- Saved schedules become intentional user data.
- The architecture supports multiple schools without multiplying permanent schedule rows.
- Caching can be added later without a major redesign.

Negative:

- Search requires generation work at request time.
- The generator must be written carefully to avoid slow searches.
- Cached search result invalidation may become necessary later.
- Debugging generated results requires good logs and reproducible search inputs.

Follow-ups:

- [ ] Rename or reinterpret `schedules` as saved or materialized schedules only.
- [ ] Add a proper `saved_schedules` and `saved_schedule_sections` model, or document that existing `schedules` tables serve that role.
- [ ] Split `possible_classes` into `sections` and `section_meetings` after the current MVP stabilizes.
- [ ] Add a deterministic `schedule_hash` for saved schedules.
- [ ] Build the generator as a pure function before connecting it to writes.
- [ ] Add latency and pruning logs to schedule search.
- [ ] Add temporary search caching only after repeat traffic proves it is useful.

## Alternatives considered

1. Store every possible schedule permutation permanently
   - Why not: It creates large amounts of unused derived data, gets worse with more schools and users, and makes invalidation harder when section data changes.

2. Precompute schedules nightly for every school and term
   - Why not: It still wastes storage and compute on schedules no user asked for, and it does not handle user-specific filters well.

3. Store every user search result permanently
   - Why not: It turns temporary search output into long-lived data and creates cleanup, privacy, and invalidation problems.

4. Generate schedules on demand with no persistence at all
   - Why not: Users need saved schedules, favorites, sharing, and later auditing of their selected options.

5. Generate schedules on demand and persist only user-selected schedules
   - Why chosen: It keeps permanent storage focused on catalog facts and user decisions while allowing search to stay flexible.

## Rollout plan

1. Treat current generated search results as transient UI data.
2. Update application code so normal searches do not insert rows into `schedules` or `schedule_sections`.
3. Insert into schedule storage only when the user saves, favorites, exports, or shares a generated schedule.
4. Add a deterministic `schedule_hash` so the same user cannot save the same schedule twice.
5. Add generator logs for candidate counts, pruned paths, valid result counts, and latency.
6. Add a normalized `sections` and `section_meetings` schema when the current `possible_classes` table becomes painful.
7. Add `schedule_search_cache` only if repeated searches show a real performance need.

## Open questions

- Should `schedules` be renamed to `saved_schedules`, or should the existing name stay for now?
- Should `favorites` point directly to saved schedules only, or should saving and favoriting remain separate actions?
- What is the first acceptable search latency target for the MVP?
- Should full sections be excluded by default or shown with a warning?
