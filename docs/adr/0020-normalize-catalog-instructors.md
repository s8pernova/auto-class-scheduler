# ADR 0020: Normalize catalog instructors

## Status

Proposed

## Implementation

State: Not started

Evidence:

- [ ] Migration creates `catalog_instructors`, backfills existing meeting
      instructors, and rewires meetings to `instructor_id`.
- [ ] Migration moves instructor preferences to instructor foreign keys.
- [ ] Backend reads instructor display names from `catalog_instructors`.
- [ ] Generation, favorites, and saved schedule reconstruction no longer read
      `catalog_section_meetings.instructor_name`.
- [ ] OpenAPI and generated TypeScript clients reflect the normalized contract.
- [ ] Tests cover backfilled instructors, preference saves, fork behavior, and
      schedule generation with instructor ratings.

Last checked: 2026-07-10

## Date

2026-07-10

## Owners

Aidan Hoo

## Context

Course Scheduler currently treats instructor names as plain text on catalog
meeting rows. ADR 0010 correctly separated user preference scores from catalog
section data, but the implementation still lacks a durable instructor entity.
That creates three problems:

- Instructor ratings can be stored only by name text, not by a stable catalog
  instructor key.
- Changing instructor ratings in a draft can look like transient UI state rather
  than a real persistable change.
- Future catalog editing, publishing, forking, and imports cannot distinguish
  "this meeting is taught by the same catalog instructor" from "this string
  happens to match another string."

Existing catalogs already contain instructor names in
`catalog_section_meetings.instructor_name`. That data should not be manually
reentered, and a seed-only migration would preserve the wrong model. The
professional fix is a structural migration that promotes existing instructor
names into first-class catalog instructor rows, then rewires references.

Constraints:

- Existing instructor names stored on meeting rows must be preserved.
- Instructor preference scores remain user-owned preference data, not objective
  catalog facts.
- Published catalog snapshots remain immutable; editing shared catalog
  instructors must follow the existing fork-on-edit model.
- Supabase tables in `public` need RLS and explicit grants when exposed through
  the Data API.
- Migrations must be reviewable and should not be applied by automation unless
  explicitly requested.

Assumptions:

- Instructor identity is scoped to a catalog, not global across all schools,
  terms, and imported data sources.
- A normalized instructor name is sufficient for de-duplicating instructors
  inside one catalog for the MVP.
- Users append to the instructor taxonomy by committing instructor names in
  catalog section rows. A standalone "add instructor" control can be added later
  if the product needs unused instructors.
- Imported catalogs may later provide richer instructor identifiers, but those
  identifiers are not available today.

## Decision

Course Scheduler will add a catalog-scoped instructor taxonomy. Each catalog
will own a `catalog_instructors` set, catalog meeting rows will reference that
set through `instructor_id`, and user instructor preferences will reference
`catalog_instructors.id` instead of storing instructor name text. The API may
continue accepting and returning instructor names for UI ergonomics, but the
database will use foreign keys for canonical relationships.

Decision details:

- Create `catalog_instructors` with one row per normalized instructor name per
  catalog.
- Backfill `catalog_instructors` from existing nonblank
  `catalog_section_meetings.instructor_name` values.
- Add `catalog_section_meetings.instructor_id` and populate it from the
  backfilled taxonomy.
- Drop `catalog_section_meetings.instructor_name` after the backfill succeeds.
- Recreate instructor preferences as user-owned rows keyed by
  `(user_id, instructor_id)`.
- Keep preference scores optional in the frontend; a missing row means no saved
  preference.
- Keep the external draft/API shape name-oriented where that is simplest for
  the UI, while resolving names to instructor IDs at the backend/database
  boundary.
- When replacing a catalog's sections, upsert the needed catalog instructors
  and remove instructor rows no longer referenced by any meeting in that catalog.
- When forking a catalog, copy section meetings through the public replacement
  API so the target catalog gets its own instructor rows, then copy the current
  user's preferences by matching normalized instructor names between source and
  target.

In scope:

- Catalog-scoped instructor taxonomy.
- Migration/backfill from existing meeting instructor names.
- Meeting-to-instructor foreign key.
- User preference rows keyed by instructor ID.
- Backend and frontend contract updates needed for save, fork, generation, and
  saved schedule display.

Out of scope:

- Global instructor directory across schools or terms.
- External professor-rating enrichment.
- Public instructor profile pages.
- Standalone instructor management for unused instructors.
- Rich instructor aliases, departments, emails, source-system IDs, or identity
  merge workflows.

## Rationale

A catalog-scoped taxonomy is the right level of normalization for this product
right now. Instructor names are meaningful inside a student's catalog snapshot,
but the app does not yet have authoritative cross-school instructor identity.
A global table would imply false precision and create merge problems before the
product has source data to solve them.

Foreign keys give the database the responsibility it should have: meetings point
at instructor entities, and preferences point at those same entities. That
prevents ratings from drifting when display names change, avoids duplicated
preference rows for whitespace/casing variants, and gives published catalogs a
stable instructor set alongside stable section rows.

Keeping the API name-oriented where useful preserves the current editing
experience. Users think in terms of instructor names while entering catalog
rows. The backend can normalize and resolve those names without making the UI
manage database IDs for rows that may not exist until the draft is saved.

## Design and implementation notes

### Data model

Tables/columns:

- `catalog_instructors.id`: Stable instructor identity inside one catalog.
- `catalog_instructors.catalog_id`: Owner catalog; cascades with the catalog.
- `catalog_instructors.name`: Display name shown back to the user.
- `catalog_instructors.normalized_name`: Lowercased whitespace-normalized key
  used for de-duplication within the catalog.
- `catalog_section_meetings.instructor_id`: Nullable foreign key to
  `catalog_instructors.id`; null represents an unknown or omitted instructor.
- `catalog_instructor_preferences.instructor_id`: Foreign key to the instructor
  being rated.
- `catalog_instructor_preferences.user_id`: User who owns the preference.
- `catalog_instructor_preferences.preference_score`: User preference score from
  0 to 5.

Constraints and indexes:

- `catalog_instructors` has `UNIQUE (catalog_id, normalized_name)`.
- `catalog_section_meetings.instructor_id` is indexed for schedule and favorite
  reconstruction.
- `catalog_instructor_preferences` has `UNIQUE (user_id, instructor_id)`.
- `catalog_instructor_preferences.user_id` and `instructor_id` are indexed for
  user preference loads and cascade cleanup.
- Instructor display and normalized names are constrained to nonblank values no
  longer than 200 characters.
- Preference scores are constrained to `0 <= preference_score <= 5`.

Migration behavior:

1. Create `catalog_instructors`.
2. Insert distinct normalized instructor names from existing meeting rows.
3. Add and populate `catalog_section_meetings.instructor_id`.
4. Create the foreign key and supporting index.
5. Replace or migrate `catalog_instructor_preferences` to use `instructor_id`.
6. Drop obsolete text columns only after their values have been represented by
   foreign keys.
7. Update the `replace_catalog_sections` RPC so future writes resolve
   `instructor_name` input into instructor rows.

### API / interfaces

Endpoints:

- `GET /api/v1/catalogs/{catalog_id}/sections`: returns meetings with
  `instructorId` and `instructorName`.
- `PUT /api/v1/catalogs/{catalog_id}/sections`: accepts `instructorName` in
  meeting input and resolves it to `catalog_instructors`.
- `GET /api/v1/catalogs/{catalog_id}/instructor-preferences`: returns the
  current user's saved ratings keyed by instructor display name for frontend
  ergonomics.
- `PUT /api/v1/catalogs/{catalog_id}/instructor-preferences`: accepts ratings
  keyed by instructor display name, validates those names against the catalog
  taxonomy, and persists rows by `instructor_id`.

Backend service behavior:

- Section loaders hydrate instructor names from `catalog_instructors`.
- Generation loads catalog sections with hydrated instructor names, then applies
  user ratings by instructor name at the algorithm boundary.
- Saved schedule and favorite reconstruction hydrate instructor names through
  `catalog_instructors` instead of reading a meeting text column.
- Unknown instructor preference names are rejected instead of silently creating
  preferences for instructors that are not part of the catalog.
- Clearing a rating deletes or omits the corresponding preference row.

Frontend behavior:

- The schedule draft keeps `instructorRatings` as a name-keyed map because that
  matches the user's mental model and avoids exposing database IDs in editable
  draft state.
- The dirty-state check treats instructor rating changes as real draft changes
  that should enable saving.
- The inline instructor preference panel derives its visible list from committed
  catalog instructor names.
- Editing a published/shared catalog's instructors goes through the same
  fork-on-edit flow as editing section rows.

### Security and privacy

Access rules:

- `catalog_instructors` is readable when the parent catalog is readable.
- `catalog_instructors` is writable only when the parent catalog is writable by
  the current user.
- `catalog_instructor_preferences` is readable, insertable, updatable, and
  deletable only by the preference owner.
- Preference writes also require the referenced instructor to belong to a
  catalog the user may access.
- RLS policies use `TO authenticated` plus ownership/access predicates, not
  role-only checks.

Data handling:

- Store instructor names as user-provided catalog data.
- Store user preference scores separately from catalog facts.
- Do not store external professor-rating data in this taxonomy.
- Do not expose one user's preferences through a shared catalog link.

### Operations

- The migration is reviewed and committed as SQL but not applied automatically.
- Local and linked Supabase migration status should be checked before applying.
- The generated OpenAPI/TypeScript client must be regenerated after backend
  schema changes.
- Verification should include backend tests, frontend tests, typecheck, lint,
  build, and `git diff --check`.
- If the linked database has manual SQL history, reconcile migration history
  before applying this migration to avoid drift.

## Consequences

Positive:

- Existing instructor data is preserved through migration instead of reentry.
- Instructor preferences become stable foreign-keyed data.
- Catalog edits, publication, forks, generation, and favorites share one
  instructor model.
- The UI can stay simple while the database becomes properly normalized.
- Future importer support can enrich catalog instructor rows without changing
  preference ownership.

Negative:

- Replacing section rows now needs instructor resolution and cleanup logic.
- The migration touches a central table and must be reviewed carefully before
  being applied.
- Name-based de-duplication can still conflate two different instructors with
  the same display name inside one catalog.
- Standalone "add instructor without a meeting" remains a future product
  decision.

Follow-ups:

- [ ] Implement and review the normalization migration.
- [ ] Update backend services and RPCs to resolve instructor names to IDs.
- [ ] Regenerate OpenAPI and TypeScript clients.
- [ ] Update tests for preferences, generation, favorites, and forks.
- [ ] Decide later whether the UI needs explicit unused instructor management.
- [ ] Revisit richer identity fields when importer data provides authoritative
      instructor IDs.

## Alternatives considered

1. Keep `catalog_section_meetings.instructor_name` and add a preferences table
   keyed by name
   - Why not: It preserves string drift, duplicate casing/spacing variants, and
     weak relationships between meetings and preferences.

2. Add only a seed migration for existing preferences
   - Why not: There is no reliable existing preference source to seed from, and
     it would leave meetings and future preferences on the wrong data model.

3. Manually redo instructors in production data
   - Why not: Existing meeting instructor names are already structured enough to
     backfill deterministically, and manual reentry would be error-prone.

4. Create a global `instructors` table
   - Why not: The app lacks authoritative cross-school identity, so a global
     table would create false equivalence between same-name instructors in
     different catalogs, schools, or terms.

5. Make the frontend manage instructor IDs directly
   - Why not: Draft editing naturally starts from names, and IDs may not exist
     until save. Backend resolution keeps the UI ergonomic while preserving a
     normalized database.

## Rollout plan

1. Replace the current instructor-preference-only migration with a normalized
   instructor migration before it is applied anywhere.
2. Backfill existing meeting instructor names into `catalog_instructors`.
3. Rewire meeting rows to `instructor_id` and drop the old meeting text column.
4. Move instructor preferences to `instructor_id` with owner-only RLS.
5. Update `replace_catalog_sections` to upsert instructor rows from committed
   meeting names and clean up unreferenced instructor rows.
6. Update backend loaders, generation, favorites, and saved schedule
   reconstruction to hydrate instructor names through `catalog_instructors`.
7. Keep frontend drafts name-keyed, but ensure instructor rating changes are
   dirty/saveable changes.
8. Regenerate OpenAPI and TypeScript clients.
9. Run backend and frontend verification without applying the migration.
10. Review the SQL, then apply it through the normal Supabase migration workflow
    only after explicit approval.

## Open questions

- Should the first standalone instructor-management UI allow unused instructors,
  or should the taxonomy remain derived only from committed meeting rows?
- If two different instructors share the same name inside one catalog, do we add
  an alias/disambiguation field, or wait for importer-provided source IDs?
