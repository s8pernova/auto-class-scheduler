# ADR 0007: Persist catalogs as normalized section data

## Status

Accepted

## Date

2026-05-27

## Owners

Aidan Hoo

## Context

Course Scheduler lets users build a bring-your-own-catalog candidate set, then
generates valid schedules from that catalog and their current preferences.
Earlier ADRs established that generated schedules should be treated as derived
data and that the MVP should support manual and paste-to-table catalog entry.

The remaining persistence question is how to store the catalog a user builds.
The frontend already has a draft shape that can be serialized as one JSON
payload, and storing that payload in a single `jsonb` column would be fast to
implement. However, the catalog is core product data, not just an opaque draft.
It needs validation, ownership, future import paths, reuse across schedule
requests, and a clean path to saving favorites later.

Constraints:

- The MVP should save user-built catalogs without storing every generated result.
- Catalog rows should be queryable by course, section, CRN, instructor, and
  meeting time.
- The schema should support manual entry, paste-to-table entry, and later CSV or
  importer flows through the same canonical model.
- User-created catalogs must stay user-owned through RLS.
- Generated results should remain transient until a user explicitly saves or
  favorites a schedule.

Assumptions:

- Student-sized catalogs are small enough for synchronous generation.
- Users may generate multiple result sets from the same saved catalog as they
  change preferences.
- A saved favorite should eventually be able to reference the exact catalog
  sections the user chose.

## Decision

Course Scheduler will store saved catalogs as normalized relational data:
`catalogs` for catalog identity, `catalog_sections` for candidate section rows,
and `catalog_section_meetings` for section meeting blocks. Generated schedule
results will remain transient derived data and will not be persisted unless the
user explicitly saves or favorites a schedule.

Decision details:

- `jsonb` may be used for source metadata, raw import snapshots, flexible parser
  metadata, and temporary draft/cache records.
- `jsonb` will not be the canonical storage format for saved catalog sections.
- Catalog section rows and meeting blocks will have database constraints,
  indexes, and RLS policies.
- Instructor preference scores should remain separate from raw section rows.
- The generation endpoint should build its request from saved catalog rows plus
  current transient preferences.
- Persistent schedule requests can be added later if the product needs named,
  reusable request definitions.

In scope:

- Canonical persistence for user-built catalog sections.
- Keeping generated result sets transient.
- Choosing normalized tables over one large JSON blob for saved catalogs.

Out of scope:

- Persisting every generated schedule permutation.
- Implementing saved favorites in this ADR.
- Designing public catalog sharing or marketplace features.
- Finalizing the long-term persistent schedule request model.

## Rationale

Normalized catalog storage is more professional for this project because the
catalog is durable product data. It lets the database enforce data quality, lets
the backend query and update specific rows, and keeps future features from
depending on opaque JSON parsing.

This choice supports:

- Field-level validation and constraints for course numbers, CRNs, and meeting
  times.
- Efficient queries and indexes for catalog editing, duplicate detection,
  filtering, and generation.
- Row-level ownership through normal RLS policies.
- Cleaner migrations when the section model changes.
- Reuse of the same saved catalog across multiple generation attempts.
- Future save/favorite flows that point at explicit section records.

Keeping generated schedules transient remains consistent with ADR 0001. Results
are derived from catalog rows plus preferences. Persisting all results would add
storage cost, invalidation complexity, and confusing canonical data before the
user has chosen anything worth saving.

## Design and implementation notes

### Data model

Recommended tables:

```sql
catalogs
  id uuid primary key
  name text not null
  description text
  source_type text not null
  school_name text
  term_name text
  status text not null
  row_count integer not null
  source_metadata jsonb not null
  created_by uuid references auth.users(id)
  created_at timestamptz not null
  updated_at timestamptz not null
  last_imported_at timestamptz

catalog_sections
  id uuid primary key
  catalog_id uuid not null references catalogs(id) on delete cascade
  subject_code text not null
  course_number integer not null
  section_code text
  crn text
  instructor_name text
  sort_order integer not null
  source_metadata jsonb not null
  created_at timestamptz not null
  updated_at timestamptz not null

catalog_section_meetings
  id uuid primary key
  section_id uuid not null references catalog_sections(id) on delete cascade
  days text not null
  start_time time not null
  end_time time not null
  sort_order integer not null
```

Recommended constraints and indexes:

- `catalog_sections.catalog_id`: index for loading a catalog.
- `(catalog_id, subject_code, course_number)`: index for grouping candidate
  sections during generation.
- `(catalog_id, crn)`: non-unique index for duplicate warnings and lookup.
- `catalog_section_meetings.section_id`: index for loading meetings.
- `end_time > start_time`: check constraint on meetings.

The MVP catalog table should only store fields the BYOC flow actually collects.
Course title, credits, campus, modality, room/location, seats, and restriction
fields are deferred until the product supports entering or importing them.

### API / interfaces

Initial endpoints:

- `GET /api/v1/catalogs/{catalog_id}`: fetch catalog identity.
- `GET /api/v1/catalogs/{catalog_id}/sections`: fetch saved sections and
  meetings for editing or generation.
- `PUT /api/v1/catalogs/{catalog_id}/sections`: replace the saved candidate
  section set for the catalog from a validated draft.
- `POST /api/v1/schedules/generate`: generate transient results from saved
  catalog rows plus current request preferences.

The first implementation may use a full replace endpoint for catalog sections.
That keeps the frontend simple and avoids complex row-level patch semantics
while the editable table is still changing.

Later endpoints may add:

- `PATCH /api/v1/catalogs/{catalog_id}/sections/{section_id}` for row-level
  editing.
- `POST /api/v1/catalogs/{catalog_id}/sections/import` for paste, CSV, or
  importer flows.
- `POST /api/v1/saved-schedules` for saving a selected generated schedule.

### Security and privacy

Access rules:

- Users can read, insert, update, and delete their own catalogs.
- Users can read, insert, update, and delete sections and meetings only through
  catalogs they own.
- Demo catalogs can remain public read-only if marked as demo data.

Data handling:

- Store user-entered section facts as canonical rows.
- Store parser/import details in `source_metadata` when useful.
- Do not store generated result sets by default.
- Do not store external professor-rating data in catalog section rows.

### Operations

Generation should load the saved catalog rows, apply the current transient
preferences, generate conflict-free schedules, and return the result payload.

Logs should record counts and timings rather than full user-entered catalog
contents unless local development explicitly needs deeper debugging.

## Consequences

Positive:

- Catalogs become durable, queryable, and reusable.
- The schema supports future import paths without changing the core generator
  contract.
- RLS and ownership rules stay straightforward.
- Saved favorites can later reference explicit catalog sections.
- Generated results stay cheap and easy to invalidate.

Negative:

- More tables and endpoints than a single `jsonb` blob.
- Full replacement saves require careful transaction handling.
- The frontend needs mapping code between table rows and API payloads.
- Schema migrations are needed when saved section fields change.

Follow-ups:

- [ ] Add `catalog_sections` migration.
- [ ] Add `catalog_section_meetings` migration.
- [ ] Add RLS policies and grants for catalog child tables.
- [ ] Add API schemas for catalog sections and meetings.
- [ ] Add list and replace endpoints for catalog sections.
- [ ] Persist the BYOC table before generating schedules.
- [ ] Generate from saved catalog rows plus transient preferences.
- [ ] Add saved schedule/favorite persistence for user-selected results.

## Alternatives considered

1. Store the entire catalog draft in one `catalogs.draft_json` or
   `catalogs.source_metadata` blob
   - Why not: Fast to ship, but weak for validation, querying, RLS, migrations,
     duplicate detection, and future save/favorite references.

2. Persist every generated schedule result
   - Why not: Results are derived data, most permutations are never used, and
     persistence creates invalidation and storage problems before the user has
     selected a schedule worth saving.

3. Store both normalized rows and a canonical JSON copy
   - Why not: Dual canonical representations drift unless there is a strong
     operational need. JSON snapshots can be metadata or audit artifacts, not
     the source of truth.

4. Keep all catalogs client-side until favorites exist
   - Why not: Users expect named catalogs to survive refreshes and sessions, and
     saved favorites need stable catalog section references.

## Rollout plan

1. Add normalized catalog section and meeting tables with RLS.
2. Add backend schemas and services for listing and replacing catalog sections.
3. Save the BYOC table into the catalog before moving to generation.
4. Update generation to load saved catalog rows for the current catalog.
5. Keep generated results in frontend context unless the user saves a schedule.
6. Add saved schedule/favorite persistence for selected generated schedules.

## Open questions

- Should anonymous users get local-only drafts, server-side temporary drafts, or
  be required to sign in before saving a catalog?
- Should the MVP save catalog sections on every edit, on step transition, or
  only when the user clicks a save/continue action?
- Should persistent schedule requests be added before saved favorites, or only
  after users ask for reusable request definitions?
