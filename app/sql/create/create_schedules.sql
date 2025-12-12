CREATE TABLE schedules (
    id                      BIGSERIAL PRIMARY KEY,

    -- summary metrics so you can sort/filter in the UI
    total_credits           INTEGER     NOT NULL,
    total_instructor_score  NUMERIC,                  -- sum or average of instructor_rating
    num_sections            INTEGER     NOT NULL,

    num_days_on_campus      INTEGER,                  -- how many distinct days have in-person meetings
    earliest_start          TIME,                     -- earliest class start in the week
    latest_end              TIME,                     -- latest class end in the week

    -- day flags (handy for quick filters)
    meets_mon               BOOLEAN     NOT NULL DEFAULT FALSE,
    meets_tue               BOOLEAN     NOT NULL DEFAULT FALSE,
    meets_wed               BOOLEAN     NOT NULL DEFAULT FALSE,
    meets_thu               BOOLEAN     NOT NULL DEFAULT FALSE,
    meets_fri               BOOLEAN     NOT NULL DEFAULT FALSE,
    meets_sat               BOOLEAN     NOT NULL DEFAULT FALSE,

    -- e.g. 'Annandale-only', 'Alexandria-only', 'Mixed', 'Online-only'
    campus_pattern          TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);