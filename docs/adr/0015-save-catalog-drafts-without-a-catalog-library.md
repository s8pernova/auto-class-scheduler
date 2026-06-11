# ADR 0015: Save catalog drafts without a catalog library

## Status

Proposed

## Date

2026-06-11

## Owners

Aidan Hoo

## Context

Course Scheduler is centered on bring-your-own catalog setup. Users may spend
real time pasting, cleaning, and manually entering candidate sections before
they are ready to generate schedules or publish a shareable catalog.

That work should not disappear when a signed-in user leaves the app. At the
same time, a full "My Catalogs" library risks adding a stale, noisy management
surface before the product needs it. The MVP should solve the practical "I want
to continue what I was working on" problem without making users manage an
archive of old drafts and published catalogs.

Existing ADRs already establish the surrounding model:

- ADR 0007 stores saved catalogs as normalized relational data, not as one
  opaque JSON draft.
- ADR 0012 treats published catalogs as immutable shareable snapshots and uses
  draft forks for edits.
- ADR 0014 reframes the main product surface as a catalog workspace rather than
  a linear wizard.

Constraints:

- Durable catalog drafts require an account.
- Published catalogs should remain stable snapshots.
- The MVP should avoid a catalog dashboard, search, folders, archive flows, or
  other collection-management features.
- Users should not have to remember an internal draft URL for the app to feel
  like it saved their unfinished work.

Assumptions:

- Most users will have one active unfinished catalog at a time.
- Published catalog reuse can remain URL/share-slug based for the MVP.
- If users accumulate many old catalogs, that is a later product signal for a
  real catalog-management surface.

## Decision

Course Scheduler will support durable signed-in catalog drafts, but it will not
introduce a full catalog library for the MVP. The app may surface a single
"continue where you left off" action for the current user's most recently
updated editable draft. Broader published catalog discovery and old-catalog
management remain link-based or out of scope.

Decision details:

- Signed-in users can save unfinished editable catalogs as server-side drafts.
- Anonymous users may experiment locally, but durable saving requires sign-in.
- Saving a draft uses the existing normalized catalog model and full section
  replacement behavior.
- The primary resume UI is a single recent-draft affordance, not a list of every
  catalog the user has ever created.
- Published catalogs remain immutable snapshots; editing a published or shared
  catalog creates or confirms a draft fork first.
- Published catalog reuse remains share-link based. The app does not add a
  public or private catalog library for MVP.

In scope:

- Durable saved drafts for signed-in users.
- Manual save draft behavior and dirty-state protection.
- A single "continue where you left off" entry point for the most recent
  editable draft.
- Draft, published, and fork semantics as they affect saving catalog work.

Out of scope:

- A "My Catalogs" dashboard or table.
- Search, sorting, folders, pinning, archiving, or bulk management for catalogs.
- Public catalog discovery or marketplace features.
- Anonymous server-side drafts or account-merge behavior.
- Autosave as the initial MVP save model.
- Changing the normalized catalog persistence schema.

## Rationale

Saving unfinished catalog work is core to the BYOC product. A student might
spend a long session cleaning rows and still not be ready to generate schedules.
Requiring them to finish in one sitting makes the app feel fragile.

A full catalog library solves a broader problem than the MVP has proven. It can
quickly become a seemingly random section full of old catalogs that users do not
care about. That adds information architecture and cleanup pressure without
directly improving the main catalog-building flow.

A recent-draft resume action is a smaller and more useful primitive. It lets
the app remember the user's active unfinished work while keeping published
catalog reuse URL-based. If users later need to manage many active catalogs, the
product can grow into an explicit catalog-management surface with evidence.

Manual save is also the right starting point. It gives users clear control over
when the current table replaces the persisted draft, makes dirty-state warnings
straightforward, and avoids the extra failure modes of autosave.

## Design and implementation notes

### Data model

- Use the existing `catalogs`, `catalog_sections`, and
  `catalog_section_meetings` tables as the durable draft storage.
- Keep `catalogs.status = 'draft'` as the normal editable saved-work state.
- Keep `catalogs.status = 'published'` as the immutable shareable snapshot
  state.
- Do not add a catalog-library table or a separate draft JSON column.

### API / interfaces

- Keep `POST /api/v1/catalogs` as the account-required draft creation path.
- Keep `PUT /api/v1/catalogs/{catalogId}/sections` as the manual draft section
  save path for editable catalogs.
- Add or expose a small authenticated endpoint for the latest editable draft,
  such as `GET /api/v1/catalogs/recent-draft`.
- Do not expose a broad catalog list in the primary MVP UI unless a later ADR
  chooses a catalog-management surface.

### Frontend behavior

- The catalog workspace should expose an explicit `Save Draft` action.
- The workspace should track whether the current client state differs from the
  last saved server state.
- If the user has unsaved changes, warn before navigation or before actions that
  rely on persisted catalog rows.
- The app entry surface may show `Continue: <catalog name>` for the most recent
  editable draft.
- The app entry surface should also keep a clear `Start new catalog` action.
- Published/shared catalog edit attempts should follow the fork-before-edit
  behavior from ADR 0012.

### Security and privacy

- Durable draft creation and saving require an authenticated user.
- Users can only read and write their own draft catalogs through authenticated
  access rules.
- Published catalogs remain readable through their share route according to ADR 0012.
- Shared catalog links must not expose another user's draft list or recent draft.

## Consequences

Positive:

- Users can leave unfinished catalog work and continue it later.
- The MVP avoids a cluttered "My Catalogs" surface.
- The UI stays focused on the current catalog workspace.
- Published catalog sharing remains simple and URL-based.
- The implementation builds on the existing normalized catalog persistence
  model.

Negative:

- Users cannot browse all old catalogs from the app UI.
- Users who maintain multiple active drafts may need to keep URLs themselves
  until a real catalog-management feature exists.
- The latest-draft affordance may not be enough for heavier users.
- Manual save means the app must clearly communicate unsaved changes.

Follow-ups:

- [ ] Add an authenticated latest-editable-draft API.
- [ ] Add a `Continue where you left off` entry action when a recent draft
      exists.
- [ ] Add explicit `Save Draft` behavior in the catalog workspace.
- [ ] Add dirty-state warnings for unsaved catalog changes.
- [ ] Keep published/shared catalog edits on the fork-before-edit path.
- [ ] Revisit a full catalog-management surface only if users need multiple
      active drafts, old draft recovery, or published catalog management.

## Alternatives considered

1. Add a full "My Catalogs" dashboard now
   - Why not: It solves too broad a problem for the MVP and risks becoming a
     stale, low-value section of old catalogs.

2. Make users bookmark or store every draft URL themselves
   - Why not: It keeps the UI simple, but it makes "save for later" feel
     unreliable if the app cannot help the user recover the most recent draft.

3. Autosave every edit
   - Why not: Autosave is polished, but it introduces failure, retry, and
     conflict behavior before the manual save flow is proven.

4. Store anonymous server-side drafts
   - Why not: Anonymous durable drafts create ownership, cleanup, and account
     merge questions that are not necessary for the MVP.

5. Store the whole unfinished catalog as `draft_json`
   - Why not: ADR 0007 already chose normalized saved catalog storage as the
     canonical data model.

## Rollout plan

1. Add the latest-editable-draft backend contract for authenticated users.
2. Keep catalog creation and section replacement account-required.
3. Add the landing or entry-surface `Continue where you left off` action.
4. Add manual `Save Draft` and saved/unsaved state to the catalog workspace.
5. Add dirty-state warnings before leaving or running persisted-data actions.
6. Verify create, save, leave, return, publish, and fork behavior.
