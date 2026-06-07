# Course Scheduler

Course Scheduler is a bring-your-own-catalog class schedule generator built around reusable, shareable course catalogs.

It helps students draft a catalog, publish a stable catalog link, share that link with classmates, select required courses and elective choices, generate schedule permutations, and save favorite schedules for that specific catalog.

## Why this exists

Most class schedule tools:

- Work only for one school, or a bunch of schools I'm not in.
- Require the school to pay for an institutional product.
- Let students draw a schedule manually, but do not generate all valid combinations.
- Can generate schedules, but building the catalog is painful.
- Make every student rebuild the same catalog data on their own.
- Ignore professor quality, seat data, restrictions, or student preferences.

Course Scheduler is meant to solve a different problem:

```text
Bring any catalog.
Clean it up.
Publish a stable catalog link.
Let other students fork it for their own needs.
Choose the courses you need.
Add elective pools like "choose 1 of these".
Generate possible schedules.
Save only your favorite schedules for that catalog.
```

In a free, super intuitive way.

## Core idea

A student should be able to express a schedule request like this:

```text
CS 2104
AND CS 2505
AND ENGE 1414
AND choose 1 of:
  - PHIL 1304
  - STS 1504
  - ENGL 3764
```

The scheduler treats that as a requirement-group problem, then searches for valid section combinations.

## Differentiators

### Bring or reuse a catalog

This makes the app not limited to one school, and it means students in the same program do not all have to recreate the same setup. A catalog can come from:

- Pasted rows from a course schedule page
- Manual entry
- A shared catalog link from another student

### Drafts, published catalogs, and forks

Draft catalogs are editable workspaces. They are where a student can clean up pasted rows, add manual courses, and make mistakes without creating a public artifact.

Published catalogs are stable snapshots. A catalog can only be shared after it is no longer a draft, so saved schedules and share links do not break when someone changes the underlying course sections.

If a student wants to change a published or shared catalog, they fork it into a new draft. That draft can be edited freely and published as a new catalog link.

### Shareable catalogs, personal schedules

Catalogs are reusable setup data. A student should be able to build a catalog once, publish it, share it with a friend, and let that friend choose their own requirements, blocked times, instructor preferences, and schedule results.

Sharing a catalog does not mean sharing an account or exposing saved schedules. Generated schedules stay transient by default, and only the schedules a user favorites are saved. Favorites are scoped to the catalog snapshot that produced them, not treated as one global cross-semester feed.

### Actual schedule generation

The engine is meant to:

- Group sections by course
- Expand elective choices
- Generate section combinations
- Reject time conflicts
- Reject blocked-time conflicts
- Filter unavailable or restricted sections
- Return results

### Elective pools

Students often know they need an elective, but not an exact course to take.

Course Scheduler supports a CNF of requirement groups, such as:

```text
choose 1 of 5 humanities electives
choose 2 of 8 technical electives
choose 1 lab section and 1 lecture section
```

### Professor preferences

Professor quality is important when choosing a schedule, yet a lot of schedule generators don't include it.

The app supports user-entered instructor preference scores. The core app works without this data, but when ratings are available, they can help students rank generated schedules. The MVP doesn't integrate with third party sites like ratemyprofessor to do this because of their ToS.

### Saved favorites

Users can save schedules without needing a full social/profile system. Favorites exist to help someone quickly recover the good schedules they found for the current catalog. They stay personal even when the catalog came from a shared link.

## Production

```bash
docker compose up -d --build
```

## Developing

```bash
# Install
cp .env.example .env  # fill in Supabase creds and stuff
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run the API
uvicorn backend.app:app --reload --port 8020

# Run the frontend
cd ui && npm install && npm run dev
```

> [!NOTE]
> When developing the results step, use the route `/catalogs/dev-catalog/results?fixture=generated-results`.
> That should stop it from automatically going back to step 2 in the wizard.
