# ADR 0002: Model schedule requests as CNF-style requirement groups

## Status

Accepted

## Date

2026-05-18

## Owners

Aidan Hoo

## Context

The scheduler must support more than a flat list of required courses. A student may know they need certain fixed courses, while also needing one course from a larger approved elective list.

Example:

```text
CS 2104 AND CS 2505 AND ENGE 1414 AND (PHIL 1304 OR STS 1504 OR ENGL 3764)
```

This is a conjunctive normal form style request. The full request is an AND of clauses. A fixed course is a unit clause. An elective group is a clause that can be satisfied by choosing one or more courses from a set.

Constraints:

- The generator must support required courses and elective choices in the same request.
- The same engine must support manually entered catalogs and school-imported catalogs.
- The UI must show why a schedule was generated and which elective choices were selected.
- The backend must avoid hard-coding one-off elective behavior into the permutation algorithm.

Assumptions:

- A schedule request belongs to one school and one term.
- A course may have many sections.
- A section may have multiple meeting blocks.
- Some groups require every listed course.
- Some groups require N courses from M possible courses.

## Decision

Represent schedule requests as requirement groups. Each group contains candidate courses and has min/max rules that tell the engine how many courses from that group must appear in a generated schedule.

Decision details:

- Required courses are modeled as groups with `min_courses = max_courses = number_of_courses`.
- A single fixed course can also be modeled as a group with one course and `min_courses = max_courses = 1`.
- Elective pools are modeled as groups with `min_courses` and `max_courses`, commonly `1` and `1`.
- The generator first expands group-level course choices, then expands section-level choices, then rejects time conflicts.
- Generated schedules must store enough metadata to show which courses satisfied which groups.

In scope:

- Required course groups
- N-of-M elective groups
- Group-level validation
- Generator behavior for expanding course choices
- Displaying chosen electives in result cards

Out of scope:

- Degree audit integration
- Automatic discovery of approved elective lists
- Transfer credit evaluation
- Prerequisite graph solving beyond section eligibility filters

## Rationale

This design matches how students actually plan semesters. They often need fixed courses plus one or more courses from an approved elective list. A flat required-course list cannot express that.

Reasons:

- It avoids treating every selected course as mandatory.
- It lets the generator compare schedules that satisfy the same requirement with different elective choices.
- It supports future degree-plan features without requiring a rewrite.
- It keeps the UI clear by grouping courses according to the requirement they satisfy.
- It makes the engine easier to test because group expansion and section conflict detection are separate steps.

## Design and implementation notes

### Logic model

A request like this:

```text
X AND Y AND Z AND (A OR B OR C)
```

is modeled as clauses:

```text
Group 1: choose 1 of [X]
Group 2: choose 1 of [Y]
Group 3: choose 1 of [Z]
Group 4: choose 1 of [A, B, C]
```

A request like this:

```text
X AND Y AND choose 2 of [A, B, C, D]
```

is modeled as:

```text
Group 1: choose 1 of [X]
Group 2: choose 1 of [Y]
Group 3: choose 2 of [A, B, C, D]
```

### Data model

Proposed tables:

```sql
CREATE TABLE schedule_requests (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id   BIGINT NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    term_name   TEXT NOT NULL,
    name        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE schedule_request_groups (
    id           BIGSERIAL PRIMARY KEY,
    request_id   BIGINT NOT NULL REFERENCES schedule_requests(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    min_courses  INTEGER NOT NULL DEFAULT 1,
    max_courses  INTEGER NOT NULL DEFAULT 1,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (min_courses >= 0),
    CHECK (max_courses >= min_courses)
);

CREATE TABLE schedule_request_group_courses (
    group_id       BIGINT NOT NULL REFERENCES schedule_request_groups(id) ON DELETE CASCADE,
    subject_code   TEXT NOT NULL,
    course_number  INTEGER NOT NULL,
    course_suffix  TEXT,

    PRIMARY KEY (group_id, subject_code, course_number, course_suffix)
);
```

Possible generated-schedule trace table:

```sql
CREATE TABLE generated_schedule_group_choices (
    schedule_id     BIGINT NOT NULL REFERENCES saved_schedules(id) ON DELETE CASCADE,
    group_id        BIGINT NOT NULL REFERENCES schedule_request_groups(id) ON DELETE CASCADE,
    subject_code    TEXT NOT NULL,
    course_number   INTEGER NOT NULL,
    course_suffix   TEXT,

    PRIMARY KEY (schedule_id, group_id, subject_code, course_number, course_suffix)
);
```

### API / interfaces

Possible endpoints:

```text
POST /api/schedule-requests
GET  /api/schedule-requests/{request_id}
POST /api/schedule-requests/{request_id}/generate
GET  /api/schedule-requests/{request_id}/results
```

Example request body:

```json
{
  "school_id": 3,
  "term_name": "Fall 2026",
  "groups": [
    {
      "name": "Required CS courses",
      "min_courses": 2,
      "max_courses": 2,
      "courses": [
        { "subject_code": "CS", "course_number": 2104 },
        { "subject_code": "CS", "course_number": 2505 }
      ]
    },
    {
      "name": "Pathways elective",
      "min_courses": 1,
      "max_courses": 1,
      "courses": [
        { "subject_code": "PHIL", "course_number": 1304 },
        { "subject_code": "STS", "course_number": 1504 },
        { "subject_code": "ENGL", "course_number": 3764 }
      ]
    }
  ]
}
```

### Generator outline

```text
1. Load request groups.
2. Validate each group has enough candidate courses to satisfy min_courses.
3. Generate allowed course subsets per group.
4. Combine group-level subsets into candidate course plans.
5. For each candidate course plan, fetch eligible sections.
6. Generate section combinations.
7. Reject combinations with section time conflicts.
8. Reject combinations that violate blocked-time preferences.
9. Score valid schedules.
10. Store or return ranked results with group-choice metadata.
```

### Security and privacy

- Users may only create, update, and delete their own schedule requests.
- Catalog data remains public read-only unless a private catalog feature is added later.
- Generated schedule results linked to a user should use row level security.

### Operations

- The first implementation can generate schedules synchronously for small requests.
- Large requests should use a capped result set and pagination.
- The API should expose warnings when the request creates too many combinations.
- The generator should report why zero schedules were found, such as no open section, group cannot be satisfied, or all combinations conflict.

## Consequences

Positive:

- Supports elective planning naturally.
- Makes the scheduler more useful than simple required-course generators.
- Keeps future degree-requirement support possible.
- Allows result cards to explain which elective was selected.

Negative:

- More data modeling than a flat selected-courses list.
- More generator branching.
- Requires stronger validation and better empty-result messages.

Follow-ups:

- [ ] Add request/group tables in a migration.
- [ ] Add generator tests for fixed courses, 1-of-M groups, and 2-of-M groups.
- [ ] Add UI for creating elective groups.
- [ ] Add result-card display for selected group choices.
- [ ] Add cap and warning behavior for large requests.

## Alternatives considered

1. Flat selected-course list
   - Why not: Cannot represent elective pools or N-of-M requirements.

2. Boolean expression stored as text
   - Why not: Harder to validate, search, edit, and render in the UI.

3. JSON-only request model
   - Why not: Flexible, but harder to query and secure cleanly with relational constraints.

4. Optional-course boolean flag
   - Why not: Does not express how many optional courses are required.

## Rollout plan

1. Implement tables for schedule requests, groups, and group courses.
2. Update the generator to expand group-level course choices before section combinations.
3. Add UI support for required groups and elective groups.
4. Add generated-schedule trace records showing which courses satisfied each group.
5. Add tests for zero-result explanations and large combination caps.
