# ADR 0017: Defer format-flexible catalog import

## Status

Proposed

## Date

2026-06-11

## Owners

Aidan Hoo

## Context

Course Scheduler's biggest input problem is speed. A student should be able to
bring in all of the sections they are considering with as little setup work as
possible, then spend their attention on requirements, preferences, generated
schedules, and favorites.

ADR 0006 chose manual entry and paste-to-table entry for the MVP. It deferred
CSV upload, school-specific importers, scraping, and broader import workflows
because file parsing and column mapping can become their own product before the
core scheduler is proven.

There is still a valuable future idea here: many students can copy data from a
school course search page, spreadsheet, notes app, registration portal, or an
LLM-cleaned output. The fastest path is not necessarily "upload a CSV." The
fastest path is "paste whatever structured or semi-structured course data you
have, review the parsed rows, and commit the clean catalog sections."

LLMs may help students transform messy school pages into cleaner rows, CSV,
TSV, or Markdown tables. That can be useful, but it would be awkward for Course
Scheduler to depend on an external LLM workflow as the primary product story.
The app should not require students to leave the product, prompt another tool,
produce a file, and then return just to use the scheduler.

Constraints:

- The MVP should continue focusing on catalog setup, requirement groups,
  generation, sharing, and favorites.
- Import should not require students to understand CSV or prepare files before
  they can try the scheduler.
- The app should not silently trust AI-generated or externally transformed
  catalog facts.
- External scraping, browser automation, and source-specific importers remain
  out of scope unless a later ADR approves a specific source.
- Any import path must produce reviewable rows before it mutates a saved
  catalog.

Assumptions:

- Students often have course data in copyable tables, not clean files.
- CSV is useful as one input format, but it is too narrow and too technical to
  be the headline feature.
- LLM-assisted cleanup may be common, but the product should still work without
  mentioning or depending on LLMs.
- The best import UX is a review-and-correct workflow, not a blind upload.

## Decision

Course Scheduler will keep advanced catalog import out of the MVP, but preserve
the future direction as format-flexible paste/import. CSV may be one accepted
format later, but the product should frame the feature around fast catalog
intake from pasted tabular or semi-structured data, followed by a review grid.
LLM-assisted cleanup is allowed as an external or future helper, but it is not
the core workflow and must not bypass user review.

Decision details:

- Do not build CSV upload for the MVP.
- Do not advertise an LLM-dependent workflow as the import strategy.
- Treat CSV, TSV, copied table text, Markdown tables, and simple delimited text
  as possible future inputs to the same import surface.
- Prefer paste-first import over file-first import.
- Always parse into a reviewable staging grid before replacing saved catalog
  rows.
- Keep manual editing as the correction path when parsing is imperfect.
- Consider LLM-assisted parsing only as an optional future enhancement after a
  deterministic parser/review flow exists.

In scope:

- Product direction for a future fast catalog import workflow.
- The relationship between CSV, paste-to-table input, and possible LLM-assisted
  cleanup.
- Guardrails that keep import from becoming a blind or magical operation.

Out of scope:

- Implementing CSV upload.
- Implementing parser logic.
- Adding import job tables or raw-file storage.
- Adding migrations.
- Integrating an LLM provider.
- Adding scraping, browser automation, or school-specific importers.
- Changing the MVP catalog builder.

## Rationale

CSV upload sounds fast, but only after the student already has a clean CSV. For
many students, that is the hard part. If the app leads with CSV, it risks
turning the fastest-input idea into homework: find data, transform it, name
columns correctly, upload it, then debug the mapping.

Paste-first import is closer to real student behavior. Students copy rows from
a course search page, registration portal, spreadsheet, or message. The app can
accept that pasted data, infer likely columns, show the result, and let the
student fix anything weird.

LLMs fit best as an optional bridge, not as the product's foundation. A student
might use an LLM to convert a messy course page into CSV or a Markdown table,
and Course Scheduler should be able to accept that output. But the product
should not need a wink-and-nudge instruction that says "go ask a free LLM to
make the file." That makes the import feature feel incomplete and shifts trust
and failure handling outside the app.

The important product principle is reviewability. Whether data came from a
copied table, CSV, TSV, an LLM, or a future importer, the app should show what
it thinks the catalog rows are before saving them. Fast import is only useful
if students can quickly verify and correct it.

## Design and implementation notes

### Future import surface

A future import surface should behave like a staging area:

- User pastes or drops data.
- The app detects likely format and columns.
- The app maps fields into catalog-section draft rows.
- Unknown columns and low-confidence cells are highlighted.
- The user corrects rows in a grid.
- The user commits the reviewed rows into the catalog workspace.

Supported future input types may include:

- Copied table text from school course-search pages.
- TSV from spreadsheets.
- CSV text pasted directly into the app.
- CSV file upload as a secondary path.
- Markdown tables.
- Simple line-based or delimiter-based text.
- LLM-cleaned output, treated the same as any other pasted user-provided data.

### Parser behavior

The first non-MVP parser should be deterministic and local where practical:

- Split rows and cells conservatively.
- Recognize common fields such as course name, CRN, days, start time, end time,
  instructor, and optional location-like metadata.
- Preserve unmapped values for user review.
- Avoid silently dropping columns.
- Report parse warnings in the staging grid.
- Never save parsed rows without user confirmation.

### LLM-assisted cleanup

LLM assistance may be considered later for messy pasted content, but only with
guardrails:

- It should be optional.
- It should not be required to use import.
- It should return staged rows for user review, not saved catalog rows.
- It should expose uncertainty or warnings when fields are inferred.
- It should not scrape or fetch third-party course pages on the user's behalf
  unless a later ADR approves that source and workflow.

### Data model

- Do not add import job tables, uploaded-file storage, or raw import archives in
  this ADR.
- Do not persist raw pasted or uploaded content by default.
- Commit only reviewed normalized catalog rows into the existing catalog model,
  unless a later ADR introduces import history.

### API / interfaces

- No API changes are made by this ADR.
- A future implementation may keep parsing client-side for pasted text, or add
  a temporary parse endpoint if server-side validation is needed.
- Any future parse endpoint should return staged rows and warnings, not mutate
  catalog state directly.

## Consequences

Positive:

- The fast-import idea is preserved without bloating MVP scope.
- CSV remains available as a future format without becoming the product story.
- The app can benefit from LLM-cleaned data without depending on LLMs.
- Review-first import protects users from silent parser or AI mistakes.
- The direction aligns with the catalog workspace model from ADR 0014.

Negative:

- Students still need manual/paste-to-table entry for the MVP.
- Full import remains a later feature.
- Format-flexible parsing will require careful UX and validation work.
- LLM-assisted cleanup may create privacy, trust, and cost questions if brought
  inside the product later.

Follow-ups:

- [ ] Keep MVP work focused on manual entry and basic paste-to-table entry.
- [ ] Revisit format-flexible import after the core catalog workspace and
      generation flow are stable.
- [ ] Prototype a paste-first staging grid before adding CSV file upload.
- [ ] Define required and optional parsed fields before adding a broad parser.
- [ ] Decide whether LLM-assisted cleanup belongs inside the product only after
      deterministic import is proven.

## Alternatives considered

1. Build CSV upload now
   - Why not: It adds file parsing and mapping work before the MVP scheduler
     flow is fully proven.

2. Make CSV upload the main import story later
   - Why not: CSV is useful, but it centers the workflow on file preparation
     instead of fast student input.

3. Tell users to use an external LLM to make CSV
   - Why not: It may work for power users, but it makes the product feel
     incomplete and pushes data correctness outside Course Scheduler.

4. Build an in-app LLM importer now
   - Why not: It introduces provider choice, cost, privacy, prompt quality, and
     trust issues before deterministic import is proven.

5. Build school-specific importers first
   - Why not: They can be powerful, but they make the product school-by-school
     and conflict with the bring-your-own-catalog goal.

## Rollout plan

1. Do nothing for MVP beyond manual entry and basic paste-to-table support.
2. Stabilize the catalog workspace, generation, sharing, and favorites flow.
3. Prototype paste-first staging with deterministic parsing.
4. Add CSV text/file support as one input format if the staging workflow works.
5. Consider LLM-assisted cleanup only after review-first import has clear
   product value and privacy boundaries.
