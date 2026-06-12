# ADR 0016: Defer location entry until campus-aware scheduling

## Status

Proposed

## Date

2026-06-12

## Owners

Aidan Hoo

## Context

Course Scheduler is meant to be usable by students across schools, programs,
and campus layouts. Some students only care whether sections fit together by
time. Other students have to compare classes across different buildings,
campuses, online/in-person modes, or long travel gaps.

Location can matter a lot in those cases. A student choosing between several
campuses may need to avoid impossible back-to-back travel, prefer one campus,
or distinguish online sections from in-person sections. The product should not
paint itself into a corner where campus-aware scheduling is impossible later.

At the same time, Course Scheduler is currently centered on bring-your-own
catalog entry, requirement groups, schedule generation, sharing, and favorites.
Every extra field in the catalog builder increases manual-entry friction. A
visible location row or column is only worth that cost if the app uses it for
generation, filtering, warnings, or ranking.

Existing ADRs already pull in both directions:

- ADR 0006 listed `campus or location` as optional candidate-section data for
  the early BYOC concept.
- ADR 0007 later narrowed normalized catalog storage and deferred course title,
  credits, campus, modality, room/location, seats, and restrictions until the
  product supports entering or importing them.
- ADR 0004 left room for schedule-level campus filters and ranking inputs when
  the relevant data exists.

Constraints:

- The MVP should keep manual catalog entry fast enough for small student-sized
  schedules.
- The catalog builder should not add prominent fields that are not used by the
  generator, filters, result summaries, or saved schedules.
- The data model should leave room for schools with multiple campuses,
  physically large campuses, accessibility needs, or mixed online/in-person
  schedules.
- Location data entered by users should be treated as user-provided catalog
  facts, not as authoritative school data unless a future importer provides a
  trusted source.

Assumptions:

- Many MVP users will not need exact room or building data to get value from
  the scheduler.
- Students who do need location usually need it because it affects feasibility
  or preference, not because they want another display-only label.
- Multi-campus and travel-buffer support is valuable, but it should be designed
  as a scheduling feature instead of as passive metadata.

## Decision

Course Scheduler will not add a prominent manual location row or column to the
MVP catalog builder yet. Location, campus, room, building, modality, and travel
buffer support are deferred until the product can use that data for
campus-aware scheduling behavior. When location is added, it should be modeled
as optional meeting-level or section-level metadata that powers filters,
warnings, summaries, or ranking, not as a decorative field.

Decision details:

- Do not add a required location field to catalog sections.
- Do not add a prominent display-only location row or column to the main manual
  catalog-entry surface.
- Keep the current MVP path focused on course name, optional CRN, instructor,
  meeting days, and meeting times.
- Treat future `campus`, `building`, `room`, `modality`, or `location` fields
  as optional metadata.
- Prefer adding location when it can support concrete behavior such as campus
  filters, online/in-person filtering, travel-buffer warnings, or schedule
  ranking.
- If paste/import flows provide location before the manual UI is ready for it,
  preserve the value as source metadata or behind an advanced/details affordance
  until the product has a full location-aware flow.

In scope:

- Product decision for whether location belongs in the near-term catalog entry
  surface.
- Future direction for campus-aware scheduling.
- Relationship between location metadata and generation/result behavior.

Out of scope:

- Adding new database columns.
- Adding migrations.
- Adding frontend fields.
- Building campus filters, map views, travel-time calculations, or routing.
- Integrating official campus maps or school location APIs.
- Deciding the final schema for campus, building, room, modality, or online
  meeting data.

## Rationale

Location is real scheduling information, but it is not equally important for
every student. If the app asks all users to enter it before the app does
anything with it, the field becomes extra form weight. That cuts against the
BYOC goal: students should be able to enter a small candidate set quickly and
see whether valid schedules exist.

The stronger product move is to wait until location has a job. For students
choosing between campuses, the useful feature is not merely seeing "NCB 120" in
a table. It is being able to filter to one campus, avoid mixed-campus days,
spot impossible back-to-back meetings, or prefer schedules with fewer travel
burdens.

Deferring the visible field also matches the current normalized catalog model.
ADR 0007 explicitly avoids storing fields the BYOC flow does not yet collect.
Keeping location out of the primary table now does not reject the need; it
keeps the app honest until the UX, data model, and generation behavior can make
location worthwhile.

## Design and implementation notes

### Data model

- Keep the current catalog-section model unchanged for now.
- Do not add `catalog_sections.location`, `catalog_sections.campus`,
  `catalog_section_meetings.location`, or related columns in this ADR.
- If an import or paste flow receives location-like values before the schema is
  expanded, it may preserve them in `source_metadata` for review, but generation
  should not depend on unvalidated metadata.
- A future ADR should decide whether location belongs on sections, meetings, or
  both:
  - Section-level location works for simple cases where every meeting happens in
    the same place.
  - Meeting-level location is more flexible for lab/lecture combinations,
    hybrid courses, and online plus in-person meetings.

### API / interfaces

- Keep catalog section create/update payloads unchanged for now.
- Do not add location filters to generation or saved-schedule APIs until the
  catalog model can provide reliable location data.
- Future APIs may expose fields such as `campus`, `building`, `room`,
  `modality`, or `locationLabel` once the generator and results UI use them.

### Frontend behavior

- Keep the main catalog builder focused on the fields currently needed for
  generation.
- Avoid a prominent empty location row/column in the default manual-entry view.
- A future advanced/details UI may expose optional location fields for users
  who need them.
- If location is added later, the results view should make it useful through
  filtering, warnings, or schedule summaries.

### Scheduling behavior

Future campus-aware scheduling may include:

- Filter results by campus or online/in-person modality.
- Warn about back-to-back meetings on different campuses.
- Penalize or sort schedules with mixed-campus travel burdens.
- Prefer fewer distinct campus days.
- Identify schedules where all in-person meetings happen on one campus.

## Consequences

Positive:

- The MVP catalog builder stays lighter.
- The product avoids collecting data it does not use yet.
- The decision still acknowledges students with multi-campus or travel-heavy
  scheduling problems.
- Future location work can be tied to concrete scheduling behavior.
- The current schema remains aligned with ADR 0007.

Negative:

- Students who already care about campus or room location cannot model that
  preference directly in the MVP.
- Generated schedules may include combinations that are technically
  time-compatible but physically unrealistic.
- Imported or pasted location data may be preserved only as metadata until a
  later location-aware feature exists.
- The product will need another ADR before adding durable location fields.

Follow-ups:

- [ ] Revisit location fields when the app adds campus, modality, seat, or
      restriction metadata.
- [ ] Decide whether future location belongs at the section level, meeting
      level, or both.
- [ ] Design campus-aware result filters before adding prominent manual-entry
      fields.
- [ ] Consider travel-buffer warnings after the generator supports location
      metadata.
- [ ] Keep paste/import experiments from forcing visible fields into the manual
      catalog table before they are useful.

## Alternatives considered

1. Add a visible optional `location` column now
   - Why not: It helps some students, but it adds default data-entry weight
     before the app uses location for scheduling behavior.

2. Add required campus/location data
   - Why not: Many sections and schools will not have clean data available, and
     requiring it would block the core BYOC flow.

3. Store location only in `source_metadata` forever
   - Why not: Metadata is useful as a bridge, but campus-aware scheduling needs
     structured fields once the app relies on location for filtering, warnings,
     or ranking.

4. Build campus-aware scheduling immediately
   - Why not: It is a valid future feature, but the current product risk is
     still catalog setup, requirement groups, generation, sharing, and
     favorites.

5. Never support location
   - Why not: That would weaken the goal of serving students at multi-campus or
     physically large schools.

## Rollout plan

1. Keep the MVP catalog builder unchanged.
2. Preserve any opportunistic imported location values as non-authoritative
   metadata if needed.
3. Wait for a concrete campus-aware scheduling feature before adding visible
   fields or durable schema.
4. Write a follow-up ADR for the final location data model and API contract.
5. Add UI only when the results experience can use location for filtering,
   warnings, summaries, or ranking.
