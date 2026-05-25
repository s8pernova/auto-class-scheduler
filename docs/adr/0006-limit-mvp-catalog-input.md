# ADR 0006: Limit MVP catalog input to manual and paste-to-table entry

## Status

Accepted

## Date

2026-05-25

## Owners

Aidan Hoo

## Context

Course Scheduler is a bring-your-own-catalog schedule generator. The user needs a way to create a candidate set of sections before generating valid schedules.

Earlier plans included several possible catalog input paths:

```text
manual entry
paste table rows
CSV upload
school-specific importers
database seeding/import migrations
scraping or browser automation
shared catalogs
```

Supporting all of these in the MVP would expand the project into parser design, source-specific cleanup, column mapping, validation UX, import logs, retry behavior, and support for many data formats.

The current MVP goal is to prove the core schedule-building experience:

```text
Create a catalog.
Enter candidate sections.
Add optional preferences.
Generate valid schedules.
Save favorites.
```

CSV upload and database import flows are deferred because most users will not have a clean CSV ready, and the main product risk is the schedule-building experience rather than file parsing.

Constraints:

- The MVP should keep catalog creation understandable for a first-time user.
- The MVP should avoid long import-debugging workflows.
- The schedule generator should receive clean section data.
- The database should avoid storing unnecessary imported data.
- The UI should support a fast path for small student-sized schedules.
- External scraping and third-party data reuse are out of scope unless a later ADR approves a specific source.

Assumptions:

- Most MVP users will enter sections for the courses they are actively considering.
- Student-sized inputs are small enough that generation-time filtering is acceptable.
- Manual entry plus paste-to-table entry is enough to test the scheduler value.
- CSV support can be added later if users ask for it.
- School-specific importers can be added later after the core workflow works.

## Decision

For the MVP, Course Scheduler will support two catalog input paths:

```text
1. Manual section entry
2. Paste-to-table section entry
```

CSV upload, generic importers, school-specific importers, backend scraping, and database import workflows are deferred.

The wizard will use this MVP flow:

```text
1. Catalog setup
2. BYOC sections
3. Preferences
4. Results
```

Decision details:

- Step 1 collects catalog identity: name, school, term, and optional notes.
- Step 2 collects factual candidate section data through manual entry and paste-to-table entry.
- Step 2 validates section data but does not perform schedule filtering.
- Step 3 collects optional user preferences such as blocked times, instructor scores, and ranking priorities.
- Step 4 generates schedules, rejects invalid combinations, applies filters, and ranks results.
- CSV upload is deferred.
- Generic database import flows are deferred.
- School-specific importers are deferred.
- External scraping is out of scope for the MVP.

In scope:

- Manual row creation
- Editable BYOC section table
- Paste-to-table input
- Basic parsing of pasted rows
- Field validation
- Duplicate row warnings
- Section normalization before generation
- Results-step filtering and ranking

Out of scope:

- CSV upload
- XLSX upload
- Generic column-mapping UI
- School-specific importers
- Backend scraping
- Browser automation importers
- Shared public catalog marketplace
- Long-lived imported source metadata
- Database seeding as a user-facing import path

## Rationale

Manual and paste-to-table input give the project the shortest path to a usable scheduler.

Reasons:

- Users can test the generator without preparing files.
- Paste-to-table input covers the common behavior of copying rows from a course schedule page.
- CSV import adds file parsing and column-mapping work before the core generator has been proven.
- Manual entry is easy to debug because the user can see every row.
- Step 2 can focus on data quality while Step 4 handles schedule logic.
- Deferring importers keeps the MVP centered on schedule generation and favorites.

## Design and implementation notes

### Wizard flow

Recommended MVP flow:

| Step | Name          | Purpose                                             |
| ---- | ------------- | --------------------------------------------------- |
| 1    | Catalog setup | Name the catalog and optionally set school and term |
| 2    | BYOC sections | Add candidate sections manually or by pasting rows  |
| 3    | Preferences   | Add optional constraints and ranking preferences    |
| 4    | Results       | Generate, filter, rank, compare, and save schedules |

### Step 1: Catalog setup

Fields:

```text
catalog name
school name or school id, optional
term name, optional
description, optional
```

Example:

```text
Fall 2026 VT test schedule
Virginia Tech
Fall 2026
```

### Step 2: BYOC sections

Step 2 is data entry and data validation.

Fields:

```text
course subject
course number
course title, optional
section or CRN, optional
credits, optional
days
start time
end time
instructor name, optional
campus or location, optional
modality, optional
seat status, optional
restriction notes, optional
```

Step 2 should support:

```text
add row
duplicate row
delete row
paste rows
edit cells
validate required fields
show row warnings
normalize days and times
```

Step 2 should catch:

```text
missing course subject or number
missing days
missing start or end time
end time before start time
unknown day tokens
duplicate meeting rows
instructor spelling variants
```

Step 2 should not reject schedules based on conflicts. A section can conflict with another section in the candidate set because the generator will choose only one valid combination later.

### Paste-to-table behavior

Paste-to-table input should accept copied tabular text and map it into the editable grid.

Minimum parser behavior:

```text
split rows by newline
split cells by tab first
fall back to repeated spaces or commas later
trim whitespace
preserve unknown cells for review when possible
show unmapped fields before commit
```

Recommended first version:

```text
course | section | days | start | end | instructor | location
```

Example pasted rows:

```text
CS 2104    83519    M W F    11:15AM    12:05PM    MO Ellis    NCB 120
CS 2505    83545    T R      2:00PM     3:15PM     DP McPherson WHIT 300
```

### Step 3: Preferences

Step 3 is optional.

Preference groups:

```text
blocked times
instructor preferences
ranking priorities
```

Examples:

```text
avoid classes before 9:00 AM
avoid Fridays
prefer fewer campus days
prefer higher instructor scores
prefer shorter gaps
```

Instructor preference scores should be derived from instructors in Step 2 and stored in the schedule request draft, not on section rows.

### Step 4: Results

The Results step owns generation, filtering, and ranking.

Generation process:

```text
1. Normalize section rows.
2. Group candidate sections by course.
3. Build possible section combinations.
4. Reject time conflicts.
5. Reject blocked-time conflicts.
6. Apply hard filters.
7. Score and sort surviving schedules.
8. Return schedules to compare and save.
```

This keeps Step 2 fast and keeps business logic in the generator.

### Resource considerations

Normal student-sized inputs are small.

Example:

```text
5 courses
5 sections each
5^5 = 3,125 possible combinations
```

That is small enough for generation-time filtering.

A larger case:

```text
8 courses
8 sections each
8^8 = 16,777,216 possible combinations
```

That requires pruning while generating combinations. The backend should check conflicts as it builds schedules instead of building every combination first.

### Database scope

MVP storage should focus on user-owned data:

```text
catalog identity
candidate section rows for a catalog, if the catalog is saved
saved favorite schedules
saved request/favorite metadata when needed
```

Deferred storage:

```text
uploaded CSV files
raw import files
import job records
external source metadata
global professor rating data
school-wide scraped catalogs
```

The app can support temporary unsaved drafts in browser state before writing to the database.

### API shape

Suggested request payload:

```ts
type ScheduleRequest = {
  catalog: {
    id?: string;
    name: string;
    schoolId?: string;
    termName?: string;
  };
  sections: SectionInput[];
  preferences: {
    blockedTimes: BlockedTime[];
    instructorScores: Record<string, number>;
    ranking: {
      preferFewerDays: boolean;
      preferLaterStarts: boolean;
      preferHigherInstructorScores: boolean;
    };
  };
};
```

### Security and privacy

- Store only data the user enters or chooses to save.
- Keep temporary drafts client-side when possible.
- Avoid storing uploaded raw files in the MVP.
- Avoid third-party scraping.
- Avoid storing external professor ratings.
- Use RLS for saved catalogs and favorites.
- Allow anonymous local drafts if supported by the frontend.

### Operations

- Manual and pasted entry produce predictable validation errors.
- No import worker is required for the MVP.
- No import queue is required for the MVP.
- No school scraper monitoring is required for the MVP.
- Logs should include validation counts and request IDs, not full pasted schedules unless needed during local development.

## Consequences

Positive:

- Smaller MVP surface area.
- Faster path to testing schedule generation.
- Fewer parser and support issues.
- Cleaner wizard mental model.
- Lower database growth from raw imports and import metadata.
- Less legal and maintenance risk from external sources.

Negative:

- Users must enter or paste section data themselves.
- Large catalogs are inconvenient to create manually.
- CSV users will need to wait for a later version.
- School-specific importers remain unavailable in the MVP.
- Reusable school-wide catalogs require later design.

Follow-ups:

- [ ] Remove CSV upload from MVP UI plans.
- [ ] Remove generic import-worker work from MVP plans.
- [ ] Implement editable BYOC section table.
- [ ] Implement paste-to-table parsing.
- [ ] Add validation and row warnings.
- [ ] Add schedule request payload from wizard state.
- [ ] Keep generation-time filtering in the Results step.
- [ ] Revisit CSV import after MVP user testing.

## Alternatives considered

1. Support CSV upload in the MVP
   - Why not: Adds parsing, column mapping, file handling, validation UI, and support burden before the generator is proven.

2. Build school-specific importers first
   - Why not: Ties the MVP to source-specific cleanup instead of the core schedule experience.

3. Seed large catalogs directly into the database as the main path
   - Why not: Useful for demos, but it does not solve the user's BYOC workflow.

4. Require users to filter candidate sections before results
   - Why not: Step 2 should collect clean candidate data. The generator should handle conflicts, blocked times, and ranking.

5. Support manual entry only
   - Why not: Paste-to-table entry is a low-cost speed boost for users copying rows from a schedule page.

## Rollout plan

1. Keep the wizard to four steps: Catalog setup, BYOC sections, Preferences, Results.
2. Remove CSV upload from the MVP scope.
3. Remove user-facing database import workflows from the MVP scope.
4. Build the BYOC section table for manual entry.
5. Add paste-to-table parsing.
6. Add validation and row warnings.
7. Send clean section data and preferences to the generator.
8. Add CSV/importer support only after the MVP proves demand.

## Open questions

- Should saved catalogs be required, or should users be able to generate schedules from an unsaved draft?
- Should paste-to-table support named column headers in the first version?
- Should the app provide sample rows to teach the paste format?
- Should school-specific importers get separate ADRs later?
