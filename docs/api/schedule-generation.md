# Schedule Generation API

`POST /api/v1/schedules/generate` accepts a saved catalog ID plus transient
preferences and returns transient, unsaved schedule options.

Candidate sections are persisted first through
`PUT /api/v1/catalogs/{catalogId}/sections`. Generation then loads those
normalized catalog rows instead of accepting the full BYOC table inline.

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

Meeting day codes are `M`, `T`, `W`, `R`, `F`, and `S`; use `R` for Thursday.
Times should be sent as `HH:MM`.
