# ADR 0009: Retire pre-MVP catalog and schedule tables

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

Those decisions leave several pre-MVP tables in an awkward transitional state:
`possible_classes`, `schools`, `saved_schedules`, and
`saved_schedule_sections`. They are useful for demos, seed data, and older code
paths, but they no longer represent the long-term source of truth for the BYOC
product.

Constraints:

- The MVP should stay focused on user-created catalogs and transient generation.
- Existing demo and development flows should not be broken by a premature table
  drop.
- Any destructive migration must happen only after application reads and writes
  have moved to the replacement model.
- User-owned saved data must not be lost without an explicit migration or
  product decision.

Assumptions:

- User-built catalogs will remain the canonical input to generation.
- School and term are catalog metadata for the BYOC product, not the primary
  product entry point.
- Saved/favorited schedules, when reintroduced, should reference catalog-scoped
  section records rather than the old school-scoped catalog table.
- Demo data can be reseeded through the catalog model when it is still useful.

## Decision

Course Scheduler will retire the pre-MVP tables `possible_classes`, `schools`,
`saved_schedules`, and `saved_schedule_sections` after their remaining runtime
dependencies have been removed or migrated. They should be treated as legacy
compatibility tables until then, not as tables that new product work should
extend.

Decision details:

- Do not add new product features that depend on `possible_classes` or
  `schools` as canonical catalog data.
- Do not treat the current `saved_schedules` and `saved_schedule_sections`
  tables as the final saved-results model.
- Generate schedules from `catalog_sections` and `catalog_section_meetings`.
- Store school and term values as catalog metadata unless a later ADR introduces
  shared public school catalogs.
- If saved results are added, design them around `catalogs` and
  `catalog_sections`, with a migration path for any real user data that exists
  in the legacy saved tables.
- Drop the legacy tables only in a dedicated migration after code search,
  tests, and data checks show they are no longer needed.

In scope:

- The deprecation direction for the four pre-MVP tables.
- The replacement ownership boundary for catalog and saved-result data.
- The high-level cleanup sequence.

Out of scope:

- Writing the destructive drop migration now.
- Final saved-results or favorites schema design.
- Public/shared catalog marketplace design.
- External school importer design.

## Rationale

Keeping the old tables around as semi-official models would blur the product
architecture. The current product direction is catalog-centered: a user creates
or selects a catalog, edits sections in that catalog, and generates transient
schedule options from it. `possible_classes` and `schools` encode the older
supported-school framing, while the current saved schedule tables come from the
earlier materialized-schedule era.

Retiring the tables later, rather than immediately, keeps the cleanup safe.
There are still references in code, migrations, seed data, and ADR history.
Treating the tables as deprecated now prevents new dependencies from forming
while allowing the project to remove them when replacement flows are complete.

## Design and implementation notes

### Data model

Legacy tables to retire:

- `possible_classes`: replace with catalog-scoped `catalog_sections` and
  `catalog_section_meetings`.
- `schools`: replace with `catalogs.school_name`, `catalogs.term_name`, and
  other catalog metadata for the BYOC product.
- `saved_schedules`: do not extend as the final saved-results table.
- `saved_schedule_sections`: do not extend as the final saved-result section
  join table.

Preferred canonical tables:

- `catalogs`: user-owned or demo catalog identity and metadata.
- `catalog_sections`: user-entered candidate sections scoped to a catalog.
- `catalog_section_meetings`: meeting blocks for catalog sections.

Future saved-result tables should be designed in a later ADR or migration. They
should reference catalog IDs and catalog section IDs so a saved result is tied to
the catalog data the user actually used.

### API / interfaces

New and updated API work should prefer:

- `GET /api/v1/catalogs/{catalog_id}`
- `GET /api/v1/catalogs/{catalog_id}/sections`
- `PUT /api/v1/catalogs/{catalog_id}/sections`
- `POST /api/v1/schedules/generate`

Legacy endpoints or services that read `possible_classes`, `schools`,
`saved_schedules`, or `saved_schedule_sections` should either be removed,
rewired to the catalog model, or explicitly marked as temporary demo support.

### Security and privacy

- User-created catalog data stays protected through catalog ownership RLS.
- Legacy public-read catalog tables should not gain new sensitive or user-owned
  data.
- Before dropping saved schedule tables, check whether they contain real user
  data and either migrate it or intentionally discard only disposable demo data.

### Operations

The cleanup should happen in phases:

1. Stop adding new runtime dependencies on the legacy tables.
2. Move generation, demo data, and any save/favorite flow to catalog-scoped
   tables.
3. Search the codebase, migrations, seeds, docs, and tests for remaining
   references.
4. Confirm production or hosted database contents are disposable or migrated.
5. Drop legacy grants, policies, indexes, foreign keys, and tables in a
   dedicated migration.

## Consequences

Positive:

- The data model aligns with the BYOC product direction.
- New features have one canonical place to read catalog data.
- The project avoids carrying both school-seeded and catalog-centered models
  indefinitely.
- A later saved-results design can be built around the current catalog schema
  instead of inheriting old assumptions.

Negative:

- Some demo and compatibility paths need to be rewritten before the tables can
  disappear.
- Historical migrations will still mention the old tables even after they are
  dropped.
- Saved/favorite persistence needs a fresh design pass before it becomes a
  long-term feature.

Follow-ups:

- [ ] Replace any remaining generation reads from `possible_classes`.
- [ ] Move demo catalog data into `catalogs`, `catalog_sections`, and
      `catalog_section_meetings`.
- [ ] Decide the catalog-scoped saved-results model before rebuilding favorites.
- [ ] Audit hosted database data in the legacy saved schedule tables.
- [ ] Add a dedicated migration to drop the legacy tables after runtime
      dependencies are gone.

## Alternatives considered

1. Keep the legacy tables indefinitely
   - Why not: It preserves old assumptions and makes it unclear which schema is
     canonical for new work.

2. Drop the tables immediately
   - Why not: Current code, seed data, and migrations still reference them, and
     a destructive migration should wait until replacement flows are verified.

3. Reuse the current saved schedule tables as the final saved-results model
   - Why not: The existing tables came from an older schedule persistence model.
     Saved results should be redesigned around catalogs and catalog sections.

## Rollout plan

1. Treat the four tables as deprecated in planning and code review.
2. Complete generation from saved catalog rows.
3. Port demo data away from `possible_classes` and `schools`.
4. Design catalog-scoped saved results and favorites.
5. Migrate or discard any real data from the legacy saved tables.
6. Drop the legacy tables in one explicit cleanup migration.
