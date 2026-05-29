# ADR 0008: Use course names for BYOC section grouping

## Status

Accepted

## Date

2026-05-29

## Context

ADR 0007 made catalog sections durable, normalized data. Its first schema used
`subject_code` and `course_number` as the implicit course identity because that
matched the early school-style examples.

For bring-your-own-catalog entry, that is too restrictive. Users should be able
to name a course or requirement group however they want, within a length limit.
The UI prevents duplicate course names in a catalog, so the name can also be the
MVP grouping key for generation.

## Decision

Replace school-style course identity on `catalog_sections` with a single
required `course_name` field.

Remove these catalog-section columns from the BYOC model:

- `subject_code`
- `course_number`
- `section_code`

Keep `crn` as the optional section identifier. Keep meeting days as compact text
on `catalog_section_meetings`, with a database check that only allows the day
codes `M`, `T`, `W`, `R`, `F`, and `S`.

Generation groups candidate sections by `course_name`.

## Consequences

- Users can name courses and requirement groups freely.
- The schema stays small while the product is early.
- Duplicate course names must remain blocked by the UI, and later by backend
  request validation.
- Imported school-style course codes can be reintroduced later as optional
  metadata if the product needs them.

This supersedes the parts of ADR 0007 that treated
`catalog_sections.subject_code + catalog_sections.course_number` as the
candidate-section grouping key.
