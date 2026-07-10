# ADR 0009: Retire pre-MVP school catalog tables

## Status

Accepted

## Date

2026-05-29

## Owners

Aidan Hoo

## Context

Course Scheduler has been moving from an early school-seeded schedule generator
toward a bring-your-own-catalog product. Earlier ADRs made pieces of that
direction explicit:

- ADR 0001 decided that generated schedules are derived data and should not be
  permanently stored unless a user explicitly saves something.
- ADR 0005 made the catalog-first BYOC flow the product direction.
- ADR 0007 introduced `catalogs`, `catalog_sections`, and
  `catalog_section_meetings` as the durable catalog model.
- ADR 0008 made `catalog_sections.course_name` the MVP grouping key instead of
  school-style subject and course-number columns.

Those decisions leave the pre-MVP school catalog tables in an awkward
transitional state. `possible_classes` and `schools` are useful for older demo
data and seeded-school flows, but they no longer represent the long-term source
of truth for the BYOC product.

Saved schedules are different. A generated schedule should remain transient
until the user chooses it, but once the user saves or favorites a result, the
app needs durable saved schedule data. The `favorites` table also needs a
persisted schedule target, so deleting saved schedule storage would remove the
natural foreign-key anchor for favorites.

Constraints:

- The MVP should stay focused on user-created catalogs and transient generation.
- Existing demo and development flows should not be broken by a premature table
  drop.
- Any destructive migration must happen only after application reads and writes
  have moved to the replacement model.
- User-owned saved schedules and favorites must not be lost without an explicit
  migration or product decision.
- Favorites should be named as user-owned data, not generic global data.

Assumptions:

- User-built catalogs will remain the canonical input to generation.
- School and term are catalog metadata for the BYOC product, not the primary
  product entry point.
- Saved schedules should reference the catalog and selected catalog sections
  used to create them.
- Favorites should point at saved schedules, not transient generated results.
- Demo data can be reseeded through the catalog model when it is still useful.

## Decision

Course Scheduler will retire the pre-MVP school catalog tables
`possible_classes` and `schools` after their remaining runtime dependencies have
been removed or migrated. It will keep a durable saved schedule model:
`saved_schedules` and `saved_schedule_sections` remain necessary product tables,
and `favorites` should be renamed to `user_favorites` rather than dropped.

Decision details:

- Do not add new product features that depend on `possible_classes` or
  `schools` as canonical catalog data.
- Generate schedules from `catalog_sections` and `catalog_section_meetings`.
- Store school and term values as catalog metadata unless a later ADR introduces
  shared public school catalogs.
- Keep `saved_schedules` as the durable record created when a user saves or
  favorites a generated result.
- Keep `saved_schedule_sections` as the durable list of selected sections for a
  saved schedule.
- Evolve saved schedule rows so they reference `catalogs` and
  `catalog_sections` rather than the retired school catalog tables.
- Rename the database table `favorites` to `user_favorites` and keep it as a
  user-owned join from a user to a saved schedule.
- Do not rename public API routes as part of this ADR; route naming is product
  interface design and does not need to mirror database table names.
- Drop only the retired school catalog tables in a dedicated migration after
  code search, tests, and data checks show they are no longer needed.

In scope:

- The deprecation direction for `possible_classes` and `schools`.
- The decision to keep saved schedule storage.
- The decision to rename the `favorites` database table to `user_favorites`.
- The high-level cleanup sequence.

Out of scope:

- Writing the destructive drop migration now.
- Final saved schedule column design.
- Public/shared catalog marketplace design.
- External school importer design.

## Rationale

Keeping `possible_classes` and `schools` around as semi-official models would
blur the product architecture. The current product direction is
catalog-centered: a user creates or selects a catalog, edits sections in that
catalog, and generates transient schedule options from it. `possible_classes`
and `schools` encode the older supported-school framing.

Saved schedules and favorites are not legacy in the same way. They represent a
real user action after generation. Without `saved_schedules`, a favorite has to
point at either a transient result ID or an oversized serialized payload. A
durable saved schedule table gives favorites a stable target, supports later
sharing/exporting, and matches ADR 0001's rule that only user-selected results
become permanent data.

Renaming the database table from `favorites` to `user_favorites` makes
ownership explicit and leaves room for other favorite-like features later, such
as favoriting catalogs, templates, or shared schedule examples. This storage
rename does not require a matching API route rename.

## Design and implementation notes

### Data model

School catalog tables to retire:

- `possible_classes`: replace with catalog-scoped `catalog_sections` and
  `catalog_section_meetings`.
- `schools`: replace with `catalogs.school_name`, `catalogs.term_name`, and
  other catalog metadata for the BYOC product.

Product tables to keep and evolve:

- `saved_schedules`: one row per schedule intentionally saved by a user.
- `saved_schedule_sections`: selected catalog sections for a saved schedule.
- `user_favorites`: renamed from `favorites`; user-owned relation to a saved
  schedule.

Preferred canonical tables:

- `catalogs`: user-owned or demo catalog identity and metadata.
- `catalog_sections`: user-entered candidate sections scoped to a catalog.
- `catalog_section_meetings`: meeting blocks for catalog sections.
- `saved_schedules`: user-owned saved schedule identity and summary fields.
- `saved_schedule_sections`: saved schedule membership, preferably referencing
  `catalog_sections`.
- `user_favorites`: the current user's favorited saved schedules.

The saved schedule model should move toward this ownership shape:

```text
catalogs
catalog_sections
catalog_section_meetings
saved_schedules
  user_id
  catalog_id
  schedule_hash
  summary fields
saved_schedule_sections
  saved_schedule_id
  catalog_section_id
user_favorites
  user_id
  saved_schedule_id
```

### API / interfaces

Generation stays transient:

- `POST /api/v1/schedule-generation-sessions`

Catalog APIs stay catalog-scoped:

- `GET /api/v1/catalogs/{catalog_id}`
- `GET /api/v1/catalogs/{catalog_id}/sections`
- `PUT /api/v1/catalogs/{catalog_id}/sections`

This ADR does not rename or design public API routes for saved schedules or
favorites. Existing routes may keep their current product-facing names while
the storage layer changes underneath them. Any future API route rename should
be handled as a separate API decision with compatibility and versioning
considered explicitly.

Legacy endpoints or services that read `possible_classes` or `schools` should
either be removed, rewired to the catalog model, or explicitly marked as
temporary demo support.

### Security and privacy

- User-created catalog data stays protected through catalog ownership RLS.
- Saved schedules and user favorites must be protected by owner-scoped RLS.
- Public-read legacy catalog tables should not gain new sensitive or user-owned
  data while they are waiting to be retired.
- Before dropping `possible_classes` or `schools`, check whether they contain
  any non-disposable demo data that needs to become a catalog.

### Operations

The cleanup should happen in phases:

1. Stop adding new runtime dependencies on `possible_classes` and `schools`.
2. Move generation and demo data to catalog-scoped tables.
3. Update saved schedule rows to reference `catalogs` and `catalog_sections`.
4. Rename the `favorites` database table to `user_favorites` and update storage
   and query references without treating API route names as part of this
   decision.
5. Search the codebase, migrations, seeds, docs, and tests for remaining
   runtime references to `possible_classes` and `schools`.
6. Confirm hosted database contents are disposable or migrated.
7. Drop legacy grants, policies, indexes, foreign keys, and the retired school
   catalog tables in a dedicated migration.

## Consequences

Positive:

- The catalog data model aligns with the BYOC product direction.
- Favorites keep a stable saved schedule target.
- Saved schedules remain intentional user data instead of transient generation
  output.
- New catalog features have one canonical place to read section data.
- The project avoids carrying both school-seeded and catalog-centered catalog
  models indefinitely.

Negative:

- Some demo and compatibility paths need to be rewritten before
  `possible_classes` and `schools` can disappear.
- The saved schedule model needs a schema cleanup instead of a simple deletion.
- Renaming the `favorites` table requires coordinated SQL, RLS, service, and
  type updates, even though public API routes do not need to change.
- Historical migrations will still mention the old tables after they are
  dropped.

Follow-ups:

- [ ] Replace any remaining generation reads from `possible_classes`.
- [ ] Move demo catalog data into `catalogs`, `catalog_sections`, and
      `catalog_section_meetings`.
- [ ] Update `saved_schedules` to reference `catalogs`.
- [ ] Update `saved_schedule_sections` to reference `catalog_sections`.
- [ ] Rename the `favorites` database table to `user_favorites`.
- [ ] Add owner-scoped RLS and grants for saved schedules and user favorites.
- [ ] Add a dedicated migration to drop `possible_classes` and `schools` after
      runtime dependencies are gone.

## Alternatives considered

1. Keep the legacy school catalog tables indefinitely
   - Why not: It preserves old assumptions and makes it unclear which catalog
     schema is canonical for new work.

2. Drop all pre-MVP tables, including saved schedules and favorites
   - Why not: Favorites need a durable saved schedule target, and saved
     schedules are valid product data once the user explicitly chooses a
     generated result.

3. Keep `favorites` as a generic table name
   - Why not: The table stores user-owned favorites specifically. Renaming it
     to `user_favorites` makes ownership and scope clearer.

4. Rename API routes to match storage tables
   - Why not: API route naming is a separate product interface decision.
     Database cleanup should not force client-facing route changes.

## Rollout plan

1. Treat `possible_classes` and `schools` as deprecated in planning and code
   review.
2. Keep `saved_schedules` and `saved_schedule_sections` as product tables.
3. Complete generation from saved catalog rows.
4. Port demo data away from `possible_classes` and `schools`.
5. Migrate saved schedule references from school catalog rows to catalog rows.
6. Rename the `favorites` database table to `user_favorites` without renaming
   public API routes as part of this ADR.
7. Drop only `possible_classes` and `schools` in an explicit cleanup migration.
