# ADR 0013: Defer cross-user schedule deduplication

## Status

Proposed

## Date

2026-06-08

## Owners

Aidan Hoo

## Context

ADR 0012 keeps generated schedules transient unless a user favorites one. In the
current model, favoriting a generated result creates a user-owned saved schedule,
stores the selected catalog sections for that schedule, and adds the favorite
row.

Two different users could theoretically favorite the exact same schedule from the
same published catalog. The application could save storage by storing that exact
schedule once and letting multiple users favorite the shared schedule record.
That case is expected to be rare for the MVP because students usually have
different requirements, blocked times, instructor preferences, and taste.

Constraints:

- Favorites must stay private and user-owned.
- Saved schedules should exist only because a user favorited them.
- Published catalog sections are stable, so schedule hashes can identify a
  specific set of selected catalog sections.
- The MVP should avoid extra RLS and migration complexity unless the product need
  is clear.

## Decision

Do not add cross-user schedule deduplication for the MVP. Keep saved schedules
user-owned and deduplicated only for the same user, catalog, and schedule hash.
Treat cross-user schedule snapshots as a possible future optimization.

Decision details:

- A generated schedule is persisted only when the current user favorites it.
- Removing a favorite removes the corresponding user-owned saved schedule.
- The existing per-user fingerprint remains the dedupe boundary.
- No new shared schedule snapshot table is introduced now.

Out of scope:

- Public sharing of individual generated schedules.
- Cross-user favorite counts, popularity metrics, or schedule discovery.
- A migration to split saved schedules into shared snapshots and user-owned
  favorites.

## Rationale

The professional schema for heavy reuse would be a shared schedule snapshot table
keyed by `(catalog_id, schedule_hash)`, with user favorites as a join table. That
is cleaner for storage if many users favorite identical schedules.

For this product stage, the storage savings are likely tiny while the cost is not:
the app would need more tables, more joins, more RLS decisions, and a migration
path for data that is not yet proving it needs optimization. Keeping schedules
user-owned also matches the current product story: favorites are a student's
personal shortlist inside one catalog.

## Consequences

Positive:

- The MVP keeps a simple persistence model.
- Favorites, saved schedules, and saved schedule sections stay easy to reason
  about as one user-owned bundle.
- The database avoids premature shared-artifact and RLS complexity.

Negative:

- Two users who favorite the exact same schedule will store duplicate saved
  schedule rows.
- Future public schedule sharing or popularity features would need a new ADR and
  migration.

Follow-ups:

- [ ] Revisit cross-user deduplication if duplicate schedule storage becomes
      measurable or individual schedule sharing becomes a product feature.

## Alternatives considered

1. Add shared schedule snapshots now
   - Why not: It is the clean long-term storage model, but it adds schema and RLS
     complexity before the MVP has evidence that duplicate storage matters.

2. Store only favorite rows and reconstruct schedules from catalog section IDs
   - Why not: It reduces storage, but pushes more reconstruction work into every
     favorites view and makes saved schedule summaries less direct to query.

## Rollout plan

1. Keep the current user-owned saved schedule tables.
2. Enforce that saved schedules are created only through the favorite flow.
3. Delete user-owned saved schedules when they are unfavorited.
4. Reconsider shared snapshots only after real usage shows meaningful duplicate
   storage or a schedule-sharing feature needs it.
