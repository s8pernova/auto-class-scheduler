# Schedule Generation API

`POST /api/v1/schedule-generation-sessions` accepts a saved catalog ID plus
transient generation inputs and view controls. It creates or reuses a bounded
Redis session and returns the first filtered, sorted result page.

Candidate sections are persisted first through
`PUT /api/v1/catalogs/{catalogId}/sections`. Generation then loads those
normalized catalog rows instead of accepting the full BYOC table inline.

Generated schedules are not persisted automatically. The database stores the
catalog configuration and candidate sections, but generation results remain
transient. When a user favorites a generated result, the client sends the
selected catalog section IDs back to the API. The backend validates and
persists only that selected schedule into `saved_schedules` and
`saved_schedule_sections`, then creates the `user_favorites` row.

The MVP endpoint rejects catalogs above 250,000 possible section combinations.
This keeps transient generation responsive until the engine grows pruning
support for larger catalogs.

The backend also enforces bounded BYOC input sizes. Defaults are:

- 12 course buckets per catalog or generated/saved schedule.
- 150 catalog sections total.
- 20 sections per course bucket.
- 5 meetings per section.
- 500 meetings per catalog.
- 20 blocked-time filters per generation request.
- 200 instructor ratings per generation request.
- 2,048 bytes of `sourceMetadata` per catalog section.
- 10,000 generated results in one complete cached session.
- 16 MiB maximum encoded session payload.
- 50 schedules per result page by default and 100 maximum.
- 30-minute fixed session lifetime by default.

Section replacement is a full replace operation:

```json
{
  "sections": [
    {
      "courseName": "PHYS 241",
      "crn": "12345",
      "instructorName": "Smith",
      "sortOrder": 0,
      "sourceMetadata": {
        "campus": "Blacksburg",
        "modality": "In Person"
      },
      "meetings": [
        {
          "days": "MWF",
          "startTime": "17:00",
          "endTime": "18:40",
          "sortOrder": 0
        }
      ]
    }
  ]
}
```

`courseName` is the grouping key for generation. Each distinct course name
represents one required course or requirement bucket, and every section with the
same course name is treated as an alternative candidate for that bucket.

By default, generation treats every distinct `courseName` in the catalog as
required. For unknown-elective cases, callers can provide CNF-style requirement
groups: every group is required, and each group can choose one or more course
buckets from its `courseNames` alternatives.

```json
{
  "metadata": {
    "catalogId": "00000000-0000-0000-0000-000000000000"
  },
  "filters": {
    "blockedTimes": [],
    "excludedDays": ["F"],
    "notBefore": "09:00",
    "notAfter": "18:00",
    "allowUnratedInstructors": true
  },
  "instructorRatings": {
    "Smith": 4.6
  },
  "sort": {
    "field": "totalGapMinutes",
    "direction": "asc"
  },
  "page": {
    "limit": 50
  }
}
```

For example, this asks for CS 2505, MATH 2114, and one humanities elective:

```json
{
  "metadata": {
    "catalogId": "00000000-0000-0000-0000-000000000000"
  },
  "requirements": {
    "groups": [
      {
        "courseNames": ["CS 2505"]
      },
      {
        "courseNames": ["MATH 2114"]
      },
      {
        "name": "Humanities elective",
        "courseNames": ["PHIL 1304", "STS 1504", "ENGL 3764"],
        "choose": 1
      }
    ]
  },
  "filters": {
    "blockedTimes": []
  },
  "page": {
    "limit": 50
  }
}
```

`choose` defaults to `1`. A group with `"choose": 2` means choose two distinct
course buckets from that group's `courseNames`.

The creation response distinguishes the complete generated universe, the
filtered matches, and the returned page. Each schedule exposes one
authoritative summary plus stable `catalogSectionId` and
`catalogSectionMeetingId` values:

```json
{
  "sessionId": "schedgen_...",
  "expiresAt": "2026-07-10T18:30:00Z",
  "candidateCount": 2400,
  "generatedCount": 516,
  "filteredCount": 430,
  "returnedCount": 50,
  "nextCursor": "eyJvIjo1MCwicSI6Ii4uLiIsInYiOjF9",
  "schedules": [
    {
      "resultId": "result_00001_...",
      "summary": {
        "meetingDays": ["M", "W", "R"],
        "numMeetingDays": 3,
        "earliestStart": "09:30:00",
        "latestEnd": "16:15:00",
        "totalGapMinutes": 75,
        "maxSingleGapMinutes": 45,
        "averageInstructorRating": 4.2,
        "ratedInstructorCount": 3,
        "unratedInstructorCount": 1
      },
      "sections": [
        {
          "catalogSectionId": "00000000-0000-0000-0000-000000000000",
          "catalogSectionMeetingId": "11111111-1111-1111-1111-111111111111",
          "courseName": "PHYS 241",
          "sectionCode": "12345"
        }
      ]
    }
  ]
}
```

Request the next page or apply different view controls with
`POST /api/v1/schedule-generation-sessions/{sessionId}/results`:

```json
{
  "filters": {
    "excludedDays": ["F"],
    "maxMeetingDays": 4,
    "maxTotalGapMinutes": 180,
    "maxSingleGapMinutes": 90,
    "minimumInstructorRating": 3.0,
    "allowUnratedInstructors": true
  },
  "sort": {
    "field": "averageInstructorRating",
    "direction": "desc"
  },
  "page": {
    "cursor": "eyJvIjo1MCwicSI6Ii4uLiIsInYiOjF9",
    "limit": 50
  }
}
```

Cursors are opaque and bound to the exact filters and sort. Start a changed
view with a null cursor. A session owned by another user is returned as not
found. An expired session returns `410 Gone` with code
`generation_session_expired`; clients should offer regeneration.

To favorite one generated result from a published catalog, `POST /api/v1/favorites`
with only the selected catalog section row IDs:

```json
{
  "catalogId": "00000000-0000-0000-0000-000000000000",
  "catalogSectionMeetingIds": ["11111111-1111-1111-1111-111111111111"]
}
```

Meeting day codes are `M`, `T`, `W`, `R`, `F`, and `S`; use `R` for Thursday.
Times should be sent as `HH:MM`.
