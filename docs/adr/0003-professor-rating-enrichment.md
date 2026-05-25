# ADR 0003: Use user-controlled instructor ratings

## Status

Accepted

## Date

2026-05-25

## Owners

Aidan Hoo

## Context

Students do not choose schedules based only on time conflicts. Instructor quality, perceived difficulty, and personal experience can affect which schedule a student prefers.

The scheduler stores instructor names on course sections. Earlier drafts considered storing an `instructor_rating` value directly on section rows and possibly enriching that value through external rating providers.

Rate My Professors is a common place students check before choosing classes. Its Terms of Use create enough restriction around scraping, automated access, reuse, and third-party display that Course Scheduler should not integrate Rate My Professors data.

The product should still let users express their own instructor preferences. A user may know an instructor from friends, advising, past classes, school forums, or their own lookup. Course Scheduler does not need to know the source of that opinion.

Constraints:

- The core scheduler must work without instructor ratings.
- Instructor ratings must be user-controlled preference data, not scraped third-party data.
- The app must not scrape, crawl, cache, import, or display Rate My Professors data.
- The app must not ask users to identify where they got an instructor opinion.
- Ratings must stay separate from raw catalog section data.
- The BYOC section table should stay focused on objective section facts such as course, section, instructor, days, times, campus, seats, and restrictions.

Assumptions:

- Users may want to rate instructors from 1 to 5 stars.
- Many sections share the same instructor.
- The same instructor name may appear in multiple courses inside the same catalog.
- For the MVP, a rating is a private catalog preference, not a canonical public instructor profile.
- Some users will skip this step.

## Decision

Course Scheduler will remove instructor rating entry from the BYOC section-editing grid and move user-entered instructor scores into a separate instructor preferences flow.

The app will deduplicate instructors from the current catalog or from the user's selected course candidates, then present a simple list where the user can assign a 1 to 5 star score. Blank scores are allowed.

The score represents the user's private preference for schedule ranking. It is not presented as an objective public rating and is not labeled as Rate My Professors data.

Decision details:

- Keep `instructor_name` on section rows.
- Remove `instructor_rating` from the editable BYOC section grid.
- Add a skippable instructor preferences step or panel.
- Store user-entered instructor scores separately from section rows.
- Use these scores only as schedule ranking inputs unless the user chooses to display them.
- Do not build a Rate My Professors provider.
- Do not store external review text, rating counts, difficulty, tags, profile IDs, or scraped source URLs from Rate My Professors.
- Do not ask the user where their rating came from.

In scope:

- Manual instructor preference scores
- Deduplicated instructor list
- 1 to 5 star input
- Blank or unknown rating state
- Per-catalog or per-user saved preferences
- Autocomplete for instructor names based on names already entered
- Schedule ranking using user preference scores

Out of scope:

- Rate My Professors scraping
- Rate My Professors API packages
- External provider adapters for Rate My Professors
- Review text storage
- Rating count storage
- Difficulty score storage
- Public professor profile pages
- School-wide canonical instructor ratings
- Source verification for user-entered scores

## Rationale

This keeps the product useful without building around restricted third-party data.

Reasons:

- Users still get the main benefit: they can tell the scheduler which instructors they prefer.
- The BYOC grid stays cleaner because section rows contain section facts, not subjective preferences.
- A separate instructor list removes duplicate work when one instructor teaches many sections.
- User-entered scores are easier to explain than imported third-party ratings.
- The app avoids scraping and reuse issues while leaving room for school-provided data in a future ADR.
- A skippable flow keeps the scheduler fast for users who only care about time conflicts.

## Design and implementation notes

### Data model

Keep instructor names on sections:

```sql
-- Existing or planned section/catalog table field
instructor_name TEXT
```

Do not put user preference scores directly on section rows.

Preferred MVP table:

```sql
CREATE TABLE catalog_instructor_preferences (
    id                         BIGSERIAL PRIMARY KEY,
    catalog_id                 UUID NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
    user_id                    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    instructor_name            TEXT NOT NULL,
    normalized_instructor_name TEXT NOT NULL,
    preference_score           NUMERIC CHECK (
        preference_score IS NULL OR
        (preference_score >= 1 AND preference_score <= 5)
    ),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (catalog_id, user_id, normalized_instructor_name)
);
```

If anonymous catalogs are supported, `user_id` may be nullable. For logged-in saved catalogs, use RLS so users only read and write their own preferences.

Helpful index:

```sql
CREATE INDEX IF NOT EXISTS idx_catalog_instructor_preferences_catalog
ON catalog_instructor_preferences(catalog_id);
```

A later migration can remove or stop writing legacy `possible_classes.instructor_rating` after the UI no longer depends on it.

### Normalization

Use a simple normalized instructor key for dedupe:

```ts
export function normalizeInstructorName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
```

This handles simple duplicates such as `Jane Smith`, `jane smith`, and `Jane   Smith`.

### Wizard UI

Recommended flow:

```text
1. Add or import catalog
2. Clean section data
3. Choose courses / requirement groups
4. Rate instructors, optional
5. Generate schedules
```

The rating step should be skippable. It should appear after the user chooses courses, because then the app can show only instructors who matter for the current schedule request.

For a small catalog or quick-start mode, this can be an expandable panel called `Instructor preferences` instead of a full route. The data model stays the same either way.

### Rating input behavior

The app should derive the instructor list from candidate sections:

```ts
type Section = {
  id: string;
  courseKey: string;
  instructorName: string | null;
};

export function getUniqueInstructors(sections: Section[]): string[] {
  const seen = new Map<string, string>();

  for (const section of sections) {
    const rawName = section.instructorName?.trim();
    if (!rawName) continue;

    const key = normalizeInstructorName(rawName);
    if (!seen.has(key)) {
      seen.set(key, rawName);
    }
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
```

Example UI states:

```text
Instructor preferences
These scores are private to this catalog and help rank generated schedules.

MO Ellis      [★ ★ ★ ★ ☆]
O Emebo       [no score]
SB Nizamani   [★ ★ ★ ☆ ☆]
Staff         [ignore]
```

Use copy like `Your score` or `Preference score`, not `Official rating`.

### Self-building instructor list

The UI pattern is called a `creatable combobox`, `free-solo autocomplete`, or `typeahead with user-created options`.

In plain HTML, the small version is an `input` paired with a `datalist`:

```tsx
<input name="instructorName" list="known-instructors" />

<datalist id="known-instructors">
    {knownInstructors.map((name) => (
        <option key={name} value={name} />
    ))}
</datalist>
```

For a production React UI, use an accessible combobox component with creatable values. The option source should come from names already entered in the current catalog draft plus any saved instructor preferences for that catalog.

### Schedule ranking

The generator can treat instructor preference as a sorting feature:

```text
schedule_instructor_score = average preference_score across sections with a score
```

Rules:

- Ignore blank scores when calculating the average.
- Keep schedules with no scored instructors valid.
- Put missing-score handling in the sort layer, not the conflict checker.
- Let users choose whether instructor preference matters in sorting.

Possible ranking weights:

```text
time fit: 60%
instructor preference: 25%
compactness / gaps: 15%
```

These weights should be UI-tunable later.

### Security and privacy

- Treat user-entered scores as private user preference data.
- Do not show one user's instructor scores to another user.
- Do not store raw review text.
- Do not store where the user found the opinion.
- Do not scrape Rate My Professors from the backend or frontend.
- Do not use unofficial Rate My Professors packages.
- Do not label user-entered scores as third-party ratings.

### Operations

- Ratings are edited during catalog setup or schedule request setup.
- Rating changes should update generated ranking without requiring catalog re-import.
- Missing ratings should not block schedule generation.
- Logs should record preference row IDs or counts, not personal comments about instructors.

## Consequences

Positive:

- The app keeps instructor preference support.
- Users control the rating data.
- The BYOC section grid becomes simpler.
- The scheduler avoids depending on restricted external data.
- One rating can apply to many sections taught by the same instructor.

Negative:

- Users must enter scores themselves.
- Scores may be subjective, incomplete, or inconsistent.
- Cross-catalog reuse needs extra design later.
- The app will not have automatic public professor ratings in the MVP.

Follow-ups:

- [ ] Remove instructor rating input from the BYOC section grid.
- [ ] Add an instructor preferences step or panel.
- [ ] Add `catalog_instructor_preferences` migration.
- [ ] Add unique instructor extraction from selected candidate sections.
- [ ] Add a 1 to 5 star input with a blank state.
- [ ] Add creatable instructor-name autocomplete.
- [ ] Add instructor preference as an optional ranking feature.
- [ ] Stop writing legacy `possible_classes.instructor_rating` from the BYOC flow.

## Alternatives considered

1. Keep `instructor_rating` directly on each section row
   - Why not: It duplicates the same rating across many rows and mixes subjective preference data with section facts.

2. Add a full external professor-rating provider system now
   - Why not: The MVP only needs user-entered scores. Provider work adds legal, product, and maintenance cost.

3. Scrape Rate My Professors directly
   - Why not: The site terms restrict scraping, automated access, reuse, and third-party display.

4. Ignore instructor preference completely
   - Why not: Instructor choice is a major student decision factor.

5. Require ratings before schedule generation
   - Why not: Some users only want conflict-free schedules and should be able to skip ratings.

## Rollout plan

1. Rename UI language from `instructor rating` to `instructor preference` where the value is user-entered.
2. Remove the editable rating column from the BYOC section table.
3. Add instructor extraction from selected candidate sections.
4. Add the skippable instructor preferences step or panel.
5. Store preferences in `catalog_instructor_preferences`.
6. Use preferences as an optional schedule sorting input.
7. Keep external provider work out of scope until a later ADR approves a specific source.

## Open questions

- Should instructor preferences be scoped to one catalog, one school, or the user's whole account?
- Should `Staff` be hidden from the rating list by default?
- Should users be able to mark an instructor as `avoid` instead of assigning stars?
- Should instructor preference affect default sort order or only an explicit sort option?
