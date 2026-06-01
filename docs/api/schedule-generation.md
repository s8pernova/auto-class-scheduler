# Schedule Generation API

`POST /api/v1/schedules/generate` accepts a saved catalog ID plus transient
preferences and returns transient, unsaved schedule options.

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

```json
{
  "metadata": {
    "catalogId": "00000000-0000-0000-0000-000000000000"
  },
  "preferences": {
    "blockedTimes": [],
    "instructorRatings": {
      "Smith": 4.6
    }
  },
  "maxResults": 100
}
```

Generated schedule responses include stable `catalogSectionId` values for each
selected section:

```json
{
  "resultId": "generated-1",
  "sections": [
    {
      "catalogSectionId": "00000000-0000-0000-0000-000000000000",
      "courseName": "PHYS 241",
      "sectionCode": "12345"
    }
  ]
}
```

To favorite one generated result, `POST /api/v1/favorites` with only the selected catalog section IDs:

```json
{
  "catalogId": "00000000-0000-0000-0000-000000000000",
  "catalogSectionIds": ["00000000-0000-0000-0000-000000000000"]
}
```

Meeting day codes are `M`, `T`, `W`, `R`, `F`, and `S`; use `R` for Thursday.
Times should be sent as `HH:MM`.
