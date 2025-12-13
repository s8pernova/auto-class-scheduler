CREATE TABLE possible_classes (
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
