# ADR 0014: Replace the catalog wizard with a catalog workspace

## Status

Accepted

## Date

2026-06-09

## Owners

Aidan Hoo

## Context

Course Scheduler started with a route-based BYOC wizard because the product
needed to guide users from catalog creation, to request building, to generated
results. That decision kept URLs meaningful and avoided a jarring page-to-page
flow while the product model was still forming.

The product has since become more clearly catalog-centered. A catalog is not
just the first step before schedule generation. It is the durable workspace
where a student names the catalog, enters or cleans candidate sections, adds
requirements, publishes a stable share link, and returns later to edit or fork.

The current wizard framing adds ceremony that does not match that model. The
catalog builder can own the main workspace directly, with the catalog name
editable in the builder header and results treated as a related view rather
than a final wizard step.

Constraints:

- The MVP should stay focused on catalog setup, generation, sharing, and
  favorites.
- The UI should support low-friction editing without making users feel trapped
  in a stepper.
- Results and shared catalog URLs still need meaningful routes.
- Published/shared catalog edit behavior must stay aligned with ADR 0012's
  fork-on-edit model.

Assumptions:

- Most users think in terms of "the catalog I am working on" more than "the
  wizard step I am on".
- A catalog title is core workspace metadata and should be editable where the
  user is doing catalog work.
- Future import, paste, manual entry, publish, and fork flows can live inside a
  catalog workspace without needing a top-level wizard stepper.

## Decision

Course Scheduler will replace the wizard-first UI with a catalog workspace. The
primary catalog route will present the catalog builder as the main workspace,
including editable catalog name/status, catalog section entry, requirements,
instructor preferences, publish/share controls, and generation entry points.
Generated results remain a related route or panel, but the app no longer frames
the flow as a numbered wizard.

Decision details:

- Remove the visible wizard stepper from the primary catalog experience.
- Treat the catalog builder as the default catalog workspace.
- Make the catalog name editable in the catalog builder header.
- Keep catalog status, publish/share state, and fork state visible in the
  workspace header.
- Keep generated results reachable through a meaningful route such as
  `/catalogs/:catalogId/results`.
- Preserve browser refresh, back, forward, and deep-link behavior where it is
  useful.
- Treat ADR 0005's route-based wizard as superseded for UI framing, while
  preserving its useful route-state lessons.

In scope:

- Top-level frontend information architecture for catalog work.
- Removing the wizard/stepper framing from the main UX.
- Builder header responsibilities, including editable catalog name.
- Relationship between the builder and results views.

Out of scope:

- Database schema changes.
- Backend publish/fork implementation details beyond the UI implications from
  ADR 0012.
- Mobile responsive layout decisions.
- Public catalog discovery or marketplace features.
- Final visual styling tokens.

## Rationale

A workspace model matches the product better than a wizard. Catalogs are
reusable setup data, not a disposable first step. Users may return to the same
catalog to clean rows, adjust sections, publish, copy links, fork, or generate
again. A persistent builder surface makes that feel natural.

Removing the wizard also reduces UI weight. A numbered stepper implies a
linear process and a clear finish line. Course Scheduler still has a sequence,
but the more important mental model is "manage this catalog, then explore
schedules from it." The builder can show progress and readiness through
contextual status, validation, and publish controls instead of global step
numbers.

Editing the catalog name at the top of the builder is also simpler. The catalog
name is part of the workspace identity. Hiding it behind a separate creation
screen makes the first route feel like ceremony, especially once users can
reuse, publish, and fork catalogs.

## Design and implementation notes

### Frontend routes

The app should move toward a catalog workspace route shape:

```tsx
<Route path="/catalogs/new" element={<CatalogCreateOrRedirectPage />} />

<Route path="/catalogs/:catalogId" element={<CatalogWorkspaceShell />}>
  <Route index element={<CatalogBuilderPage />} />
  <Route path="results" element={<ScheduleResultsPage />} />
</Route>
```

`/catalogs/new` may remain as a lightweight creation route, but it should not
feel like step 1 of a wizard. It can create a draft and send the user directly
to the catalog workspace.

### Catalog builder

The builder header should own catalog-level controls:

- Editable catalog name.
- Draft, published, shared, or forked status.
- Publish or copy share link action when available.
- Fork/edit cue when the current catalog is published or shared.
- Save/dirty state if edits are not immediately persisted.

The builder body can stay split into focused work areas:

- Catalog sections and candidate rows.
- Requirements and elective groups.
- Instructor preferences derived from committed instructor names.
- Publish readiness or validation summary.

### Results view

Results should remain related to the current catalog, not presented as the
last step of a wizard. The results route can preserve generated-result context,
filters, selected result, and favorite actions. Navigation back to the builder
should read as returning to the catalog workspace, not going backward in a
stepper.

### Interaction model

- Creating a catalog starts a draft workspace.
- Renaming happens inline in the builder header.
- Generating schedules can publish or validate as needed according to the
  current backend contract.
- Editing a published/shared catalog follows ADR 0012 and creates or confirms a
  draft fork before catalog facts are changed.

## Consequences

Positive:

- The UI better matches the product's catalog-centered model.
- The main screen can carry catalog identity, publish state, and share state
  without a separate wizard step.
- The product feels more like a serious planning workspace and less like a
  form funnel.
- Future paste/import/manual-entry work can land inside the same builder
  surface.

Negative:

- ADR 0005's route and shell assumptions need frontend cleanup.
- The app loses the simple visual affordance of numbered progress.
- The builder must do a better job communicating readiness, validation, and
  next actions.
- Results navigation needs careful copy so users understand whether they are
  editing setup data or inspecting generated schedules.

Follow-ups:

- [ ] Replace `WizardStepper` usage with catalog workspace navigation/status.
- [ ] Rename or retire wizard-specific shell components where they no longer
      match the product model.
- [ ] Move catalog name editing into the builder header.
- [ ] Rework `/catalogs/new` so creation is lightweight and hands off to the
      workspace quickly.
- [ ] Update results navigation copy from wizard language to workspace
      language.
- [ ] Revisit desktop layout concepts after the workspace model is reflected in
      the UI.

## Alternatives considered

1. Keep the route-based wizard and restyle it
   - Why not: Better styling would not fix the mismatch between a linear
     stepper and a reusable catalog workspace.

2. Keep routes but hide only the stepper
   - Why not: This is a useful transition path, but the decision should be
     broader: the app should stop treating the builder as a wizard step in copy,
     shell structure, and visual hierarchy.

3. Make results an inline tab inside the builder only
   - Why not: Results benefit from a meaningful URL for refresh, sharing during
     development, and returning to a generated set. A related route is still
     useful even without wizard framing.

4. Require a separate catalog settings page for renaming
   - Why not: The catalog name is high-frequency workspace identity. Inline
     editing in the builder header is simpler and more discoverable.

## Rollout plan

1. Introduce the catalog workspace shell and remove visible wizard navigation
   from the main catalog flow.
2. Move catalog title/status/publish controls into the builder header.
3. Point default catalog routes at the builder workspace instead of a named
   wizard step.
4. Preserve the results route as a related catalog view.
5. Update UI copy and tests to use workspace language.
6. Verify frontend typecheck/build and smoke test create, edit, publish/fork,
   generate, and favorite flows.
