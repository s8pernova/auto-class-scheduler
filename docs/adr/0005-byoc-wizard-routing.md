# ADR 005: Use a BYOC catalog wizard with route-based steps

## Status

Accepted

## Date

2026-05-22

## Owners

Aidan Hoo

## Context

Course Scheduler is a bring-your-own-catalog class schedule generator. The product should not feel like a preloaded school database where the user first picks from a fixed list of supported schools and terms.

The user flow needs to support this product model:

```text
Bring or create a catalog.
Clean or normalize the catalog.
Choose required courses and elective pools.
Generate valid schedules.
Save favorites.
```

The app also needs a smooth guided flow. The UI should feel like one connected wizard, but the routes should still be meaningful so browser back, forward, refresh, and direct links behave correctly.

Constraints:

- The MVP should stay small.
- The routing model should not block later catalog import features.
- The UI should avoid a jarring page-to-page feeling.
- The app should not frame the main product as “pick a school we already support.”
- Existing seeded course data may be used for development and demos, but it should not define the product model.

Assumptions:

- A catalog is the main object for a schedule-building session.
- School and term are useful catalog metadata, but they are not the main entry point for strict BYOC.
- Route child components may unmount, so important wizard state must live above the routed child.
- The schedule request and generated results will eventually become persistent objects.

## Decision

Course Scheduler will use a route-based BYOC wizard where the user first creates or chooses a catalog, then builds a schedule request from that catalog, then views generated results. The wizard will use nested routes with a persistent shell, shared wizard state above the routed step, and animated step transitions for a smooth flow.

Decision details:

- Use route-based wizard steps instead of a single local `currentStep` state as the only source of truth.
- Treat catalog creation or selection as the first wizard concern.
- Treat school and term as optional catalog metadata, not the primary user flow.
- Keep a persistent wizard shell mounted across step changes.
- Store draft state in a provider or store above `<Outlet />`.
- Allow child step components to unmount without losing the draft.
- Use animation in the step frame to keep the flow feeling connected.
- Use seeded VT data only as a demo or development catalog unless the user explicitly chooses it.

In scope:

- Wizard route structure.
- BYOC-first product framing.
- Shared frontend state placement.
- Smooth step transition approach.
- MVP route names and page responsibilities.

Out of scope:

- Full CSV import implementation.
- Full paste-table parser implementation.
- Shared catalog permissions.
- Final normalized catalog schema.
- Final generated-results persistence model.

## Rationale

A route-based wizard gives the app real URLs while still allowing a smooth UI. This avoids the main weakness of a single-route wizard, where browser navigation, refresh recovery, and result links are harder to reason about.

A BYOC catalog-first flow fits the product better than a school-and-term-first flow. School and term still matter for metadata, filtering, and display, but making them the first full step makes the app feel like a fixed-school scheduler instead of a catalog workspace.

Keeping wizard state above the routed child keeps the implementation safe. Route steps can unmount, but the draft remains available in the shell-level provider or store.

This also gives the project a cleaner path later. Real importers, CSV upload, pasted rows, manual catalog entry, shared catalogs, and demo catalogs can all enter through the same catalog object.

## Design and implementation notes

### Frontend routes

Initial route structure:

```tsx
<Route path="/catalogs/new" element={<CatalogCreatePage />} />

<Route path="/catalogs/:catalogId" element={<CatalogWizardShell />}>
  <Route index element={<Navigate to="build" replace />} />
  <Route path="build" element={<ScheduleRequestStep />} />
  <Route path="results" element={<ScheduleResultsStep />} />
</Route>
```

Optional future route structure:

```tsx
<Route path="/catalogs/:catalogId" element={<CatalogWizardShell />}>
  <Route path="clean" element={<CatalogCleanStep />} />
  <Route path="build" element={<ScheduleRequestStep />} />
  <Route path="results" element={<ScheduleResultsStep />} />
</Route>
```

The wizard shell owns the stable page structure:

```tsx
function CatalogWizardShell() {
  return (
    <ScheduleDraftProvider>
      <WizardStepper />
      <AnimatedStepFrame>
        <Outlet />
      </AnimatedStepFrame>
    </ScheduleDraftProvider>
  );
}
```

### Visible wizard steps

For the full BYOC product:

```text
1. Catalog
2. Build
3. Results
```

For the MVP, catalog creation can be minimal while still keeping the route model:

```text
1. Choose or use demo catalog
2. Build schedule request
3. View results
```

### Catalog model

The app should move toward a catalog-centered model:

```ts
type Catalog = {
  id: string;
  name: string;
  sourceType: "csv" | "paste" | "manual" | "importer" | "shared" | "demo";
  schoolName?: string;
  termName?: string;
  createdBy?: string;
  createdAt: string;
};
```

School and term remain useful, but they should be treated as metadata:

```ts
type CatalogMetadata = {
  schoolName?: string;
  termName?: string;
  timezone?: string;
};
```

### Schedule draft model

```ts
type ScheduleDraft = {
  catalogId: string;
  requirementGroups: RequirementGroup[];
  blockedTimes: BlockedTime[];
  preferences: SchedulePreferences;
};
```

### Existing database alignment

The current `schools`, `school_id`, and `term_name` work may stay for now, especially for demo data and scoped queries. However, the UI should not depend on a supported-school-first flow.

Longer term, the schema should likely add a `catalogs` table and scope imported sections by `catalog_id`. Existing school and term fields can become metadata attached to a catalog or catalog section.

Possible future tables:

```text
catalogs
catalog_sections
schedule_requests
generated_schedules
generated_schedule_sections
favorites
```

### API and interfaces

Likely future endpoints:

```text
POST /catalogs
GET /catalogs/:catalogId
POST /catalogs/:catalogId/sections/import
POST /catalogs/:catalogId/schedule-requests
GET /schedule-requests/:requestId/results
POST /favorites
DELETE /favorites/:favoriteId
```

For MVP, results can still be generated from frontend state or a simple backend call, but the route model should not assume results are only local component state.

### Security and privacy

- User-created catalogs should eventually be owned by the authenticated user.
- Demo catalogs may be public read-only.
- Shared catalogs should require explicit sharing rules later.
- Favorites should remain user-owned.
- Imported catalog data should be treated as user-provided data unless marked public or shared.

### Operations

- No special scheduled jobs are required for this decision.
- Later import jobs may need status tracking if large catalog imports are added.
- Errors during import, cleanup, generation, and save actions should be visible in the UI.

## Consequences

Positive:

- The app matches the strict BYOC product direction.
- Routes are meaningful and easier to debug.
- Browser back, forward, refresh, and direct links behave better.
- The UI can still feel smooth through a persistent shell and animated step frame.
- The product can later support CSV upload, pasted rows, manual entry, importers, shared catalogs, and demo catalogs through one model.

Negative:

- Slightly more upfront structure than a single local `currentStep` wizard.
- Requires shared draft state above the routed child.
- Catalog creation becomes a first-class product concept earlier.
- The current school-scoped schema may need another pass later to become catalog-scoped.

Follow-ups:

- [ ] Create `CatalogWizardShell`.
- [ ] Add `/catalogs/new` route.
- [ ] Add `/catalogs/:catalogId/build` route.
- [ ] Add `/catalogs/:catalogId/results` route.
- [ ] Move schedule draft state above `<Outlet />`.
- [ ] Treat existing VT data as a demo catalog in the UI.
- [ ] Decide whether to add a `catalogs` table now or after the MVP route refactor.
- [ ] Decide whether generated results get a persistent `schedule_request_id` in the MVP.

## Alternatives considered

1. Single-route local wizard state
   - Why not: It gives a smooth UI quickly, but browser navigation, refresh recovery, and result links are weaker.

2. School-and-term-first wizard
   - Why not: It makes the product feel like a fixed supported-school scheduler instead of a BYOC catalog workspace.

3. Separate unrelated pages
   - Why not: It weakens the guided flow and makes the schedule-building process feel disconnected.

4. Fully persistent backend workflow before UI routing
   - Why not: Better long term, but too much for the current MVP step. The route model can come first.

## Rollout plan

1. Add the route-based wizard shell.
2. Add the catalog routes.
3. Create a temporary demo catalog path for existing seeded VT data.
4. Move existing builder UI into `ScheduleRequestStep`.
5. Move existing results UI into `ScheduleResultsStep`.
6. Move draft state into a shell-level provider or store.
7. Add animated step transitions inside the shell.
8. Later add real catalog creation methods.
9. Later add catalog-scoped persistence.
10. Later add persistent schedule request IDs.

## Open questions

- Should the `catalogs` table be added before the route refactor, or immediately after?
- Should MVP results be stored in the database or regenerated from the draft each time?
- Should a generated results URL use `catalogId` only or both `catalogId` and `requestId`?
- Should public demo catalogs be stored as normal catalogs with a `sourceType` of `demo`?
