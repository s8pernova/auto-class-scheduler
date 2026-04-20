BEGIN;

ALTER TABLE possible_classes
ADD COLUMN IF NOT EXISTS term_name TEXT,
ADD COLUMN IF NOT EXISTS crn TEXT,
ADD COLUMN IF NOT EXISTS course_suffix TEXT,
ADD COLUMN IF NOT EXISTS is_honors BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS schedule_type TEXT,
ADD COLUMN IF NOT EXISTS raw_days TEXT,
ADD COLUMN IF NOT EXISTS location_raw TEXT,
ADD COLUMN IF NOT EXISTS exam_code TEXT,
ADD COLUMN IF NOT EXISTS seats_available INTEGER,
ADD COLUMN IF NOT EXISTS capacity INTEGER,
ADD COLUMN IF NOT EXISTS availability_status TEXT,
ADD COLUMN IF NOT EXISTS comments_text TEXT,
ADD COLUMN IF NOT EXISTS restriction_level TEXT NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS requires_transfer_status BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_math_major BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_special_approval BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_laptop BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_software_bundle BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS min_completed_credit_hours INTEGER,
ADD COLUMN IF NOT EXISTS required_completed_courses TEXT[],
ADD COLUMN IF NOT EXISTS eligibility_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE possible_classes
SET crn = section_code
WHERE crn IS NULL;

CREATE INDEX IF NOT EXISTS idx_possible_classes_term_course
ON possible_classes(term_name, subject_code, course_number, course_suffix);

CREATE INDEX IF NOT EXISTS idx_possible_classes_term_crn
ON possible_classes(term_name, crn);

CREATE INDEX IF NOT EXISTS idx_possible_classes_restrictions
ON possible_classes(term_name, restriction_level, requires_transfer_status, requires_math_major, requires_special_approval);

CREATE UNIQUE INDEX IF NOT EXISTS possible_classes_term_crn_day_time_unique
ON possible_classes(term_name, crn, day_of_week, start_time, end_time);

COMMIT;
