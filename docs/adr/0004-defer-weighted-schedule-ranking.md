# ADR 0004: Defer weighted schedule ranking for MVP

## Status

Accepted

## Date

2026-05-19

## Owners

Aidan Hoo

## Context

Course Scheduler generates possible class schedules from a user-provided catalog and a set of course requirements. A future version could assign each valid schedule a weighted score and present the highest-scoring schedules first.

For the MVP, the core product risk is not weighted scoring. The core product risk is whether users can build or import a catalog, express required courses and elective groups, generate valid schedules, inspect those schedules, filter them, sort them, and save favorites.

Ranking is attractive, but it is subjective. Different students value different things. One student may prefer later starts. Another may prefer fewer campus days. Another may care most about professor quality. Another may accept a worse time slot to avoid a bad instructor.

## Decision

Course Scheduler will defer weighted schedule ranking for the MVP.

The MVP will generate valid schedules and support filtering, sorting, comparison, schedule preview, and favorites. It will not calculate one universal weighted score that claims a schedule is the best overall.

Decision details:

- The generator may compute summary fields for each valid schedule.
- The UI may let users sort by one field at a time.
- The UI may let users filter by hard preferences.
- The app will avoid hidden or unexplained ranking logic in the MVP.
- Future ranking should be optional, explainable, and user-adjustable.

In scope:

- Deferring weighted ranking/scoring.
- Keeping filterable and sortable schedule summaries.
- Preserving data needed for future ranking.

Out of scope:

- Implementing ranking presets.
- Implementing user-defined scoring weights.
- Building recommendation logic.
- Connecting ranking to professor-rating enrichment.

## Rationale

Filtering and sorting are enough for the first usable version.

A generated schedule is valid if it satisfies the requirement groups and has no time conflicts. Once valid schedules exist, users can narrow them through filters and sort them by the thing they currently care about most.

This keeps the product easier to trust:

- Filters are explicit.
- Sorts are easy to explain.
- Favorites let users make the final judgment.
- No hidden scoring system decides what is best for everyone.

This also reduces MVP scope. Weighted ranking requires product decisions about scoring formulas, default weights, missing data, professor-rating reliability, and tradeoffs between time quality and instructor quality. Those questions are worth answering later, after the core generator works.

## Design and implementation notes

### Data model

The app should still compute and store schedule summary fields where useful.

Useful schedule-level fields include:

- `total_credits`: total credit count.
- `num_sections`: number of selected sections.
- `num_days_on_campus`: count of distinct in-person campus days.
- `earliest_start`: earliest meeting start time.
- `latest_end`: latest meeting end time.
- `meets_mon` through `meets_sat`: day flags.
- `campus_pattern`: single campus, mixed campus, online-only, or similar.
- `total_instructor_score`: temporary or future-compatible professor-score summary.

The MVP should treat these as filter/sort/display fields, not as a final weighted ranking score.

### API / interfaces

The schedule generation API should return valid schedules with summary fields.

The results UI should support:

- Filter by day, time, campus, seats, modality, and professor data when available.
- Sort by earliest start, latest end, days on campus, professor score, or similar fields.
- Select a schedule and preview it on a weekly calendar.
- Save a schedule as a favorite.

### Security and privacy

No special security rules are required for ranking itself.

Saved favorites should remain user-owned.

### Operations

No separate worker is required for ranking in the MVP.

If future ranking becomes expensive, it can be calculated during schedule generation or stored as generated schedule metadata.

## Consequences

Positive:

- Smaller MVP scope.
- Easier-to-explain results.
- Less subjective product behavior.
- Lower risk of users distrusting a mysterious score.
- Future ranking remains possible because summaries are still computed.

Negative:

- The app will not initially say "best schedule" in a strong way.
- Users may need to sort and compare manually.
- The results page may feel less magical than a recommendation system.

Follow-ups:

- [ ] Build filterable schedule results.
- [ ] Build sortable schedule results.
- [ ] Build selected-schedule weekly preview.
- [ ] Build favorites.
- [ ] Keep a future idea note for optional ranking.

## Alternatives considered

1. Build ranking in the MVP
   - Why not: Too subjective and too much scope before the generator and catalog workflow are proven.

2. Hard-code one default ranking formula
   - Why not: A single formula would hide tradeoffs and could frustrate users with different preferences.

3. Let users define custom weights immediately
   - Why not: Powerful, but it adds UI and product work before the basic workflow is stable.

## Rollout plan

1. Generate valid schedules.
2. Add schedule summary fields.
3. Add filters and sorting.
4. Add a selected-schedule preview panel.
5. Add favorites.
6. Revisit optional ranking after the MVP is usable.
