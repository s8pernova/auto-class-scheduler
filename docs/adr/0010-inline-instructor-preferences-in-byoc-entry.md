# ADR 0010: Inline instructor preferences in BYOC entry

## Status

Accepted

## Date

2026-06-01

## Owners

Aidan Hoo

## Context

ADR 0003 moved instructor ratings out of the BYOC section grid and into a
separate user-controlled instructor preferences flow. It also allowed that flow
to be either a skippable step or a panel.

In the MVP UI, the instructor rating surface is small. It only lets users rate
deduplicated instructors that appear in their catalog or selected candidate
sections. A standalone tab or wizard step for only this task creates extra
navigation and leaves a sparse screen, especially while the user is still
entering section data.

The BYOC section-entry step already asks users to enter instructor names. That
is the moment when the app can build the instructor preference list naturally.

Constraints:

- Instructor scores remain optional.
- Instructor scores remain user preference data, not objective catalog facts.
- The section grid should not regain an editable `instructor_rating` column.
- Missing instructor scores must not block schedule generation.
- The UI should not create surprising preference records from unfinished typing.

## Decision

Course Scheduler will not use a standalone Instructor Ratings tab for the MVP.
Instructor preferences will appear inline inside the BYOC section-entry
experience as a compact panel or reserved grid area.

As the user commits instructor names in section rows, the app will deduplicate
those names and show them in the inline `Instructor preferences` panel. Users can
assign optional 1 to 5 star preference scores from that panel. Blank scores are
allowed.

Decision details:

- Keep `instructor_name` on section rows.
- Keep instructor preference scores stored separately from section rows.
- Derive the visible instructor list from committed instructor names in the
  current catalog draft or selected candidate sections.
- Add an instructor to the preference panel after an explicit commit action,
  such as choosing a combobox option, pressing Enter, saving the row, or leaving
  a valid completed instructor field.
- Do not add instructors from transient combobox text while the user is still
  typing.
- Use copy such as `Instructor preferences`, `Your score`, or
  `Preference score`.
- Keep the panel skippable and visually secondary to section data entry.

In scope:

- Replacing the standalone Instructor Ratings tab with an inline panel.
- Self-building instructor list behavior.
- Basic empty, unrated, rated, and ignored states.

Out of scope:

- Adding external professor-rating data.
- Adding public instructor profile pages.
- Designing broader preference controls such as blocked times or ranking
  priority weights.
- Changing the instructor preference storage model from ADR 0003.

## Rationale

Inlining the preference list reduces ceremony without mixing subjective ratings
back into the section data model. The user is already thinking about instructor
names while cleaning section rows, so showing the deduplicated preference list
nearby makes the relationship clear and removes an otherwise thin step.

The panel also avoids duplicate work. If one instructor appears in many rows,
the user rates that instructor once instead of repeating the same score across
sections.

The commit-based behavior protects against accidental entries. A creatable
combobox can support new instructor names, but unfinished input should remain
draft text until the user clearly commits it.

## Design notes

The section-entry view can reserve one area for instructor preferences:

```text
BYOC sections

[section grid / paste table]

Instructor preferences
MO Ellis      [star input]
O Emebo       [no score]
SB Nizamani   [star input]
Staff         [ignore]
```

The empty state should be quiet:

```text
No instructors yet
```

The panel should update as section rows are added, edited, or removed. If a
committed instructor no longer appears in the active draft, the UI may hide that
instructor from the current panel while preserving any saved preference row for
future reuse.
