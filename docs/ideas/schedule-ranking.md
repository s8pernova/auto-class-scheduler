# Schedule Ranking

## Status

Future idea

## Purpose

Schedule ranking would assign each valid schedule a score based on user preferences. The goal would not be to claim one schedule is universally best. The goal would be to help users sort large result sets faster.

This is not part of the MVP.

## Problem

A generator can produce many valid schedules. Filtering can narrow the list, and sorting can order by one factor at a time. That may still leave users with too many options.

Ranking could help when the user wants a balanced recommendation across multiple factors.

Example:

```text
I care about professor quality, but I also want to avoid 8 AM classes and Friday classes.
```

A ranking system could combine those preferences into one score.

## Possible ranking inputs

Time quality:

- Earliest start time.
- Latest end time.
- No 8 AM classes.
- No night classes.
- No Friday classes.
- Fewer total campus days.
- Lower total gap time between classes.
- More compact class blocks.

Professor quality:

- Average instructor rating.
- Instructor difficulty.
- Number of ratings.
- Missing professor data penalty.
- User-pinned preferred instructors.
- User-blocked instructors.

Seat and enrollment quality:

- Open seats.
- Waitlist risk.
- Full section penalty.
- Reserved/restricted section penalty.

Catalog and requirement quality:

- Chosen elective.
- Requirement group satisfied.
- Honors section preference.
- Online, hybrid, or in-person preference.
- Campus preference.
- Travel buffer between campuses or buildings.

Schedule risk:

- Staff instructor.
- Missing room.
- TBD time.
- Missing seat data.
- Special approval required.
- Restriction warnings.

## Possible ranking modes

Ranking should be optional and explainable.

Possible presets:

```text
Best professors
Latest start
Fewest campus days
Fewest gaps
Avoid Fridays
Most open seats
Balanced
```

Possible advanced mode:

```text
Professor quality: 40%
Time convenience: 30%
Campus days: 20%
Seat availability: 10%
```

## Example scoring sketch

This is only a rough idea.

```text
score = 0
score += average_professor_rating * professor_weight
score -= total_gap_minutes * gap_penalty
score -= num_days_on_campus * campus_day_penalty
score += no_friday_bonus if no Friday classes
score += late_start_bonus if earliest_start >= 10:00 AM
score -= missing_professor_data_penalty
score -= restricted_section_penalty
```

The score should be displayed with an explanation, not just a number.

Example:

```text
Why this schedule is recommended:
- No Friday classes
- Starts after 10 AM
- Average professor rating 4.3
- Only 3 campus days
- 45 minutes total gap time
```

## UX ideas

The results page could have:

- Filter panel on the left.
- Schedule result cards in the middle.
- Selected schedule weekly preview on the right.
- Sort dropdown for normal sorting.
- Optional "recommended" mode for ranking.
- Explanation panel showing why a schedule scored well.

The product should never force ranking. Users should be able to ignore it and use filters/sorts manually.

## Data needed

Schedule-level summaries:

- Total credits.
- Number of sections.
- Number of days on campus.
- Earliest start.
- Latest end.
- Total gap time.
- Day flags.
- Campus pattern.
- Average instructor rating.
- Seat availability summary.
- Warning count.

Section-level details:

- Instructor name.
- Instructor rating.
- Instructor difficulty.
- Rating count.
- Seats available.
- Capacity.
- Modality.
- Campus.
- Restrictions.
- Meeting blocks.

User preference inputs:

- Preferred start time.
- Preferred end time.
- Avoided days.
- Minimum professor rating.
- Preferred modality.
- Max campus days.
- Gap tolerance.
- Weight presets.

## Risks

- Ranking is subjective.
- Missing professor data can bias results.
- Bad default weights can make the app feel wrong.
- Users may distrust a score if the explanation is unclear.
- Ranking can hide valid options that users may actually prefer.

## MVP boundary

Not in MVP:

- One universal "best schedule" score.
- Hidden weighted scoring.
- User-defined weight sliders.
- Recommendation claims.

In MVP instead:

- Generate valid schedules.
- Filter results.
- Sort results.
- Compare selected schedules.
- Save favorites.
