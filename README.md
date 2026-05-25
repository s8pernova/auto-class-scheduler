# Course Scheduler

Course Scheduler is a bring-your-own-catalog type of class schedule generator.

It helps students build a course catalog, select required courses and elective choices, generate schedule permutations, and save favorite schedules.

## Why this exists

Most class schedule tools:

- Work only for one school, or a bunch of schools I'm not in.
- Require the school to pay for an institutional product.
- Let students draw a schedule manually, but do not generate all valid combinations.
- Can generate schedules, but building the catalog is painful.
- Ignore professor quality, seat data, restrictions, or student preferences.

Course Scheduler is meant to solve a different problem:

```text
Bring any catalog.
Clean it up.
Choose the courses you need.
Add elective pools like "choose 1 of these".
Generate possible schedules.
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

### Bring your own catalog

This makes the app not limited to one school. A catalog can come from:

- A supported school importer
- A CSV upload
- Pasted rows from a course schedule page
- Manual entry
- A shared catalog created by another user

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

### Professor rankings

Professor quality is important when choosing a schedule, yet a lot of schedule generators don't include it.

The app can store instructor names, ratings, difficulty, rating counts, and rating sources. The core app should work without this data, but when ratings are available, they can help students evaluate individual sections.

### Saved favorites

Users can save schedules under their own account without needing a full social/profile system.

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