# ADR 0019: Retire wizard chrome for catalog identity

## Status

Accepted

## Implementation

State: Not started

Evidence:

- [ ] `ui/src/components/layouts/WizardLayout.tsx` no longer renders `WizardStepper`.
- [ ] `ui/src/components/wizard/WizardStepper.tsx` is deleted after its last real consumer is removed.
- [ ] The primary catalog build surface shows an editable catalog name in the top navigation or workspace header.
- [ ] Wizard-specific component, route, CSS, and copy names are retired once no current consumer remains.

Last checked: 2026-07-10

## Date

2026-07-10

## Owners

Aidan Hoo

## Context

ADR 0014 moved Course Scheduler away from a linear catalog wizard and toward a
catalog workspace. The product has continued in that direction: the build
surface now carries the meaningful work of entering candidate sections,
deduplicating instructors, setting instructor preferences, defining
requirements, and generating schedules.

The remaining top progress circles still communicate a wizard model. They imply
that the user is moving through a short sequence of numbered steps, even though
the useful mental model is "this is the catalog I am editing." The circles also
spend the most valuable navigation space on process state that no longer helps
the user.

That space should instead reinforce catalog identity. The catalog name is the
object the user returns to, saves, publishes, forks, and generates schedules
from. Showing and editing it in the primary chrome makes the workspace feel
like one durable planning surface instead of a leftover form funnel.

Constraints:

- The build surface already combines section entry, requirements, and
  instructor preferences; do not create a separate instructor step.
- Preserve useful routes such as `/catalogs/:catalogId/build` and
  `/catalogs/:catalogId/results` while retiring the wizard framing.
- Do not change the database schema for this UI cleanup.
- Published/shared catalog edit behavior must stay aligned with ADR 0012.
- The refactor must finish the transition instead of leaving unused wizard
  components, names, CSS, or copy behind.

Assumptions:

- Users care more about recognizing the current catalog than seeing a numbered
  progress indicator.
- Readiness can be communicated through contextual validation, save state, and
  generate controls rather than top-level step circles.
- Keeping route URLs stable during the first implementation pass lowers risk
  while still allowing wizard-specific component names to be retired.

## Decision

Course Scheduler will remove the visible wizard progress circles from the
primary catalog flow and replace that top-level emphasis with editable catalog
identity. The app may keep meaningful catalog routes, but the UI, component
names, copy, and navigation chrome should no longer describe the catalog
experience as a wizard once the transition is complete.

Decision details:

- Remove `WizardStepper` from the top navigation for catalog creation and build
  routes.
- Replace the center/top catalog-flow chrome with the current catalog name when
  a catalog exists.
- Make the catalog name editable from the catalog build workspace or shared
  workspace header.
- Keep sections, requirements, and instructor preferences together in the build
  surface.
- Keep generated results as a related catalog view, not a final wizard step.
- Rename or delete wizard-specific components, exports, CSS classes, tests, and
  copy after their last current consumer is removed.
- Treat ADR 0005 as superseded for visible wizard chrome and ADR 0014 as the
  broader accepted workspace direction.

In scope:

- Top navigation and workspace header behavior for catalog routes.
- Removing the stepper/progress-circle UI.
- Editable catalog-name placement.
- Retiring wizard-specific frontend names when no current consumer remains.
- Frontend copy that still says or implies wizard progress.

Out of scope:

- Database schema changes.
- New catalog-management or "My Catalogs" surfaces.
- Public catalog discovery.
- Reworking generated schedule persistence.
- Changing the schedule-generation algorithm.
- Moving instructor preferences out of the build surface.

## Rationale

The top circles are now mostly historical scaffolding. They were useful while
the team was learning and while the product shape was still a guided wizard,
but the current product is catalog-centered. Keeping the circles makes the UI
explain an old architecture instead of the current job.

Editable catalog identity is higher-value chrome. A user may save a draft,
continue it later, publish it, fork it, share it, or generate schedules from it.
The catalog name is the stable label for all of that work, so it deserves the
space currently occupied by process markers.

Removing the visible wizard UI also makes the implementation cleaner. The build
screen already owns sections, requirements, and instructor preferences. A
separate wizard stepper now creates naming pressure across `WizardLayout`,
`WizardStepper`, `CatalogWizardShell`, route exports, and transition CSS. The
professional endpoint is one authoritative catalog workspace shell with no
unjustified compatibility wrappers.

## Design and implementation notes

### Frontend shell

The catalog route layout should move toward names that describe the durable
surface:

```tsx
<Route element={<CatalogWorkspaceLayout />}>
  <Route path="/catalogs/new" element={<CatalogCreatePage />} />
  <Route path="/catalogs/:catalogId" element={<CatalogFlowShell />}>
    <Route index element={<Navigate to="build" replace />} />
    <Route path="build" element={<CatalogBuildPage />} />
    <Route path="results" element={<ScheduleResultsPage />} />
  </Route>
</Route>
```

The exact route paths may stay stable during the refactor. The important change
is that the route shell and navigation chrome stop exposing wizard progress.

### Catalog identity control

The replacement for the progress circles should be a compact catalog identity
control:

- Show the current catalog name for persisted catalogs.
- Allow inline rename for editable draft catalogs.
- Show a clear read-only or fork-before-edit state for published/shared
  catalogs.
- Communicate save or dirty state near the name when that state exists.
- Fall back to a draft label such as `Untitled catalog` before the user has
  named it.

The control can live in the navbar center or the catalog workspace header. It
should not compete with section-entry, requirements, instructor preferences, or
generate controls.

### Build surface

The build surface remains the canonical place for:

- Candidate sections and meetings.
- Requirement groups.
- Instructor names and instructor preferences derived from committed section
  rows.
- Generation readiness and the action that creates schedule results.

Do not introduce a separate instructor route or step as part of retiring the
wizard chrome.

### Retiring old names

Once the stepper is removed, search the repo for current consumers before
leaving any compatibility surface in place. If no current consumer remains:

- Delete `WizardStepper`.
- Rename `WizardLayout` to a catalog workspace layout.
- Rename or delete `CatalogWizardShell` if it only wraps animation for wizard
  terminology.
- Rename wizard-specific CSS classes if the animation remains useful, or delete
  them if the wrapper is removed.
- Update route exports and comments that still call catalog routes
  "non-wizard" or "wizard".

## Consequences

Positive:

- The first visible catalog-flow chrome matches the catalog workspace model.
- The user sees and can edit the thing they are actually working on.
- The UI loses leftover ceremony from the learning-stage wizard.
- The build surface can remain dense and useful without pretending to be one
  step in a linear sequence.
- The implementation has a clear cleanup target for wizard-specific names and
  dead code.

Negative:

- The app loses a simple visual progress indicator.
- Readiness and next-action cues must come from local validation, save state,
  and generate controls.
- Renaming shell components may touch route imports and tests even if route
  paths stay stable.
- Published/shared catalog identity states need careful handling so users do
  not rename immutable snapshots by accident.

Follow-ups:

- [ ] Replace the navbar stepper with catalog identity chrome.
- [ ] Add or move inline catalog-name editing into the build workspace.
- [ ] Keep instructor preferences embedded in the build surface.
- [ ] Verify create, rename, save, generate, results, publish/share, and fork
      behavior.
- [ ] Remove `WizardStepper` after the replacement chrome lands.
- [ ] Rename remaining wizard-specific layout/shell/CSS/export names after
      confirming their current consumers.
- [ ] Update ADR 0014 follow-up status or implementation evidence after this
      cleanup is complete.

## Alternatives considered

1. Keep the circles but relabel them
   - Why not: It preserves the old process-centered chrome instead of
     reinforcing catalog identity.

2. Hide the labels and keep only numbered circles
   - Why not: The problem is the stepper model itself, not its text.

3. Move instructor preferences back into a standalone step
   - Why not: ADR 0010 already chose inline instructor preferences, and the
     current build surface can contain both instructors and sections.

4. Rename routes immediately
   - Why not: Stable paths are useful and do not have to expose wizard framing.
     Component names, copy, and visible chrome can be cleaned up first.

5. Leave wizard-named wrappers as compatibility shims
   - Why not: There is no reason to preserve internal wizard names without a
     verified current consumer. A complete refactor should delete or rename the
     retired path.

## Rollout plan

1. Add the editable catalog identity control in the catalog workspace/header.
2. Remove `WizardStepper` from the navbar for catalog routes.
3. Verify the build screen still contains sections, requirements, instructor
   preferences, and generation entry points.
4. Verify results navigation still works through the existing catalog route.
5. Search all imports, route exports, tests, CSS, and docs for wizard-specific
   consumers.
6. Rename or delete wizard-specific components and styles with no real current
   consumer.
7. Run frontend typecheck/build and a smoke test for catalog create, rename,
   save, generate, results, publish/share, and fork behavior.
