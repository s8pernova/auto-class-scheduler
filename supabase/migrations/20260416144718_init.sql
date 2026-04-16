BEGIN;

CREATE TABLE IF NOT EXISTS schedules (
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

CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    favorited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure a schedule can only be favorited once (per user in the future)
    UNIQUE(schedule_id)
);

CREATE TABLE IF NOT EXISTS schedule_sections (
    schedule_id     BIGINT      NOT NULL
        REFERENCES schedules(id) ON DELETE CASCADE,

    subject_code    TEXT        NOT NULL,       -- 'MTH', 'PHY', 'CSC'
    course_number   INTEGER     NOT NULL,       -- 265, 241, 208, 223
    section_code    TEXT        NOT NULL,       -- '001N', '002N', '05YN'

    -- denormalized convenience, so frontend does not have to recompute
    course_title    TEXT,
    credits         INTEGER     NOT NULL,

    PRIMARY KEY (schedule_id, subject_code, course_number)
);

CREATE TABLE IF NOT EXISTS possible_classes (
    id              BIGSERIAL PRIMARY KEY,

    -- what course this is
    subject_code    TEXT        NOT NULL,  -- 'MTH', 'PHY', 'CSC'
    course_number   INTEGER     NOT NULL,  -- 265, 241, 208, 223
    course_title    TEXT,                  -- optional, 'Calculus III'

    -- which exact section
    section_code    TEXT        NOT NULL,  -- '001N', '002N', '05YN'

    -- term info
    credits         INTEGER     NOT NULL,  -- 3, 4, etc

    -- logistics
    campus          TEXT        NOT NULL,  -- 'Annandale', 'Alexandria', 'Zoom'
    modality        TEXT        NOT NULL,  -- 'IP', 'HY', 'CV', 'Online'
    building        TEXT,                  -- 'CS', 'CT', 'AA', etc
    room            TEXT,                  -- '0242', '0221' etc

    -- instructor and preference scoring
    instructor_name TEXT,
    instructor_rating NUMERIC,            -- 1 to 4

    -- this row's specific meeting block
    day_of_week     TEXT        NOT NULL,  -- 'Mon','Tue','Wed','Thu','Fri','Sat'
    start_time      TIME        NOT NULL,  -- '08:00'
    end_time        TIME        NOT NULL  -- '10:55'
);

CREATE INDEX IF NOT EXISTS idx_favorites_schedule_id ON favorites(schedule_id);
CREATE INDEX IF NOT EXISTS idx_favorites_favorited_at ON favorites(favorited_at);

COMMIT;