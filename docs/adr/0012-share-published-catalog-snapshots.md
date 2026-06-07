# ADR 0012: Share published catalog snapshots

## Status

Accepted

## Date

2026-06-07

## Owners

Aidan Hoo

## Context

Course Scheduler is becoming more than a single-user BYOC builder. Students in
the same semester or program should not each have to recreate the same catalog
data before they can generate schedules.

Earlier ADRs established that catalogs are durable normalized data, generated
schedules are transient by default, and favorites persist only a user-selected
schedule. Sharing changes the product model: a catalog URL can become the
collaboration unit, while schedules and favorites remain personal.

Constraints:

- Shared catalog links must not expose another user's saved schedules.
- Favorites must keep pointing at stable catalog section rows.
- Users should be able to start quickly without mandatory email-first account
  friction.
- The project should not take on custom password authentication unless there is
  a stronger product reason.
- The design should stay compatible with Supabase Auth and RLS.

Assumptions:

- A student usually works within one catalog for a semester or planning session.
- Seeing favorites from unrelated prior catalogs is not a core MVP need.
- A shared catalog is useful as setup data even when every student has different
  blocked times, instructor preferences, and favorite schedules.

## Decision

Course Scheduler will treat published catalogs as immutable, shareable snapshots.
Draft catalogs remain editable and private. Editing a published or shared
catalog creates a new draft fork with a new catalog URL. Favorites are personal
and scoped to the catalog snapshot that produced them.

Decision details:

- Draft catalogs are editable workspaces and do not have public share links.
- Publishing freezes the catalog's candidate sections and makes the catalog
  shareable.
- Schedule generation and favorite persistence operate against stable published
  catalog section IDs.
- Editing a published catalog, or modifying a catalog received from a shared
  link, creates a forked draft instead of mutating the published snapshot.
- Favorites are shown in the context of the current catalog, not as a global
  cross-semester feed.
- The default identity path should be lightweight, preferably Supabase anonymous
  auth with optional email upgrade for recovery, rather than custom
  per-catalog username/password auth.

In scope:

- Catalog lifecycle semantics for draft, published, and forked catalogs.
- Share-link behavior for catalogs.
- Favorite ownership and catalog scoping.
- High-level auth direction for low-friction saving.

Out of scope:

- Exact route names and UI copy.
- Final table names, column names, and migration SQL.
- Public catalog discovery, search, ratings, or marketplace features.
- Sharing a specific generated schedule as its own public artifact.

## Rationale

Immutable published catalogs prevent saved schedules from becoming invalid when
someone edits the underlying course sections. A favorite can safely reference
catalog section IDs because the published catalog snapshot does not change.

Fork-on-edit also matches user expectations for shared data. A student can use a
friend's catalog as a starting point, make their own changes, and publish a new
link without damaging the original catalog.

Keeping favorites catalog-scoped fits the product better than a global account
dashboard. Favorites exist to help a student recover good schedules found while
working on one catalog. Old favorites from unrelated catalogs or semesters are
not the primary workflow.

Supabase anonymous auth gives the app a low-friction "start now" experience
while preserving stable user IDs and RLS-compatible ownership. Custom
per-catalog username/password auth would feel When2meet-like, but would require
the project to own password hashing, sessions, recovery rules, and abuse
controls.

## Design and implementation notes

### Data model

- Catalogs need lifecycle state that distinguishes editable drafts from
  published snapshots.
- Published catalogs need shareable identifiers that are separate from internal
  database IDs.
- Forked catalogs should preserve lineage back to their source catalog when that
  is useful for debugging or UX.
- Saved schedules and favorites should continue to reference concrete catalog
  section IDs from the published snapshot that produced them.

### API / interfaces

- Catalog creation starts as a draft.
- Publishing a catalog validates and freezes the candidate section set, then
  returns or exposes the shareable catalog URL.
- Loading a shared catalog opens the published snapshot for generation.
- Editing a published/shared catalog creates a new draft fork.
- Favorite endpoints should require a user identity, but that identity can be an
  anonymous Supabase user.

### Security and privacy

- Draft catalogs are private to their owner/session.
- Published catalogs are readable through their share link.
- A share link grants access to catalog setup data only, not saved schedules or
  favorites.
- Favorites and saved schedules remain private to the user identity that created
  them.
- RLS policies must account for anonymous Supabase users using the
  `authenticated` role, rather than treating them as unauthenticated `anon`
  requests.

### Operations

- No background permutation storage is introduced by this decision.
- Generated schedules remain transient unless favorited.
- Publishing should be an explicit or clearly communicated transition because it
  changes the catalog from editable draft to stable snapshot.

## Consequences

Positive:

- Students can share reusable catalog setup data.
- Favorites remain stable because published catalog section rows do not mutate.
- The product gets a low-friction collaboration model without a full social
  account system.
- The design keeps generated schedule storage bounded and intentional.

Negative:

- Editing published catalogs requires a fork flow and new URLs.
- Users may need education that publishing freezes the catalog snapshot.
- Anonymous users can lose access if they clear browser data or switch devices
  before upgrading to a recoverable account.
- RLS and API authorization need a pass before anonymous users can safely create,
  publish, fork, and favorite.

Follow-ups:

- [ ] Add explicit draft and published catalog states to the backend contract.
- [ ] Add catalog publish and fork behavior.
- [ ] Add shareable published catalog URLs.
- [ ] Update favorites to be presented as catalog-scoped.
- [ ] Evaluate Supabase anonymous auth for low-friction catalog creation and
      favorites.
- [ ] Update RLS policies for published catalog reads and anonymous
      authenticated users.

## Alternatives considered

1. Require global email accounts for all catalog and favorite workflows
   - Why not: It preserves straightforward ownership, but adds account friction
     before users understand the product value.

2. Use custom per-catalog username/password auth
   - Why not: It matches the When2meet feel, but creates custom auth,
     recovery, session, and security responsibilities.

3. Allow shared catalogs to stay mutable
   - Why not: Favorites and saved schedules could break or become misleading
     when the referenced catalog sections change.

4. Save every generated schedule for a shared catalog
   - Why not: It conflicts with ADR 0001 and stores large amounts of derived
     data most users will never care about.

5. Keep catalogs private and only share saved schedules
   - Why not: It misses the highest-leverage collaboration point, which is
     reusing the catalog setup before each student explores their own schedules.

## Rollout plan

1. Document the draft, publish, fork, and catalog-scoped favorite model.
2. Add backend catalog lifecycle support.
3. Add published catalog read access and share URLs.
4. Change edits to published/shared catalogs into fork creation.
5. Add low-friction user identity for saving favorites, preferably anonymous
   Supabase auth with optional email upgrade.
6. Update the frontend flow so publishing, sharing, forking, and favorites match
   the new model.
7. Verify RLS, OpenAPI generation, TypeScript build, and frontend build after
   the API changes.
