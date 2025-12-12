CREATE TABLE schedule_sections (
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
