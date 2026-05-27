# Schedule Generation API

`POST /api/v1/schedules/generate` accepts a bring-your-own-catalog schedule
request and returns transient, unsaved schedule options.

Use explicit arrays rather than course-name object keys. Course identity belongs
in fields such as `subjectCode` and `courseNumber`; this keeps the JSON stable
and easy to validate.

The MVP endpoint accepts up to 12 courses, up to 30 candidate sections per
course, and rejects requests above 250,000 possible section combinations. This
keeps transient generation responsive until the engine grows pruning support for
larger catalogs.

```json
{
  "metadata": {
    "catalogId": "00000000-0000-0000-0000-000000000000",
    "name": "Fall 2026 test schedule",
    "schoolName": "Virginia Tech",
    "termName": "Fall 2026"
  },
  "courses": [
    {
      "subjectCode": "PHYS",
      "courseNumber": 241,
      "courseTitle": "University Physics",
      "sections": [
        {
          "sectionCode": "001",
          "crn": "12345",
          "instructorName": "Smith",
          "instructorRating": 4.6,
          "campus": "Blacksburg",
          "modality": "in-person",
          "credits": 4,
          "meetings": [
            {
              "days": "MWF",
              "startTime": "17:00",
              "endTime": "18:40"
            }
          ]
        }
      ]
    }
  ],
  "preferences": {
    "blockedTimes": [],
    "allowCampusSwitch": false,
    "campuses": [],
    "times": []
  },
  "maxResults": 100
}
```

Meeting day codes are `M`, `T`, `W`, `R`, `F`, and `S`; use `R` for Thursday.
Times should be sent as `HH:MM`, though the backend also accepts common AM/PM
strings such as `5:00 PM`.
