BEGIN;

-- 1) Canonical school lookup table
CREATE TABLE IF NOT EXISTS schools (
    id              BIGSERIAL PRIMARY KEY,
    slug            TEXT        NOT NULL UNIQUE, -- 'nova', 'vt'
    short_code      TEXT        UNIQUE,          -- 'NOVA', 'VT'
    display_name    TEXT        NOT NULL UNIQUE,
    state_code      TEXT,
    country_code    TEXT        NOT NULL DEFAULT 'US',
    timezone        TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Add school foreign keys to school-scoped tables
ALTER TABLE possible_classes
ADD COLUMN IF NOT EXISTS school_id BIGINT;

ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS school_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'possible_classes_school_id_fkey'
    ) THEN
        ALTER TABLE possible_classes
        ADD CONSTRAINT possible_classes_school_id_fkey
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'schedules_school_id_fkey'
    ) THEN
        ALTER TABLE schedules
        ADD CONSTRAINT schedules_school_id_fkey
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- 3) Seed initial schools
INSERT INTO schools (slug, short_code, display_name, state_code, country_code, timezone)
VALUES
    ('nova', 'NOVA', 'Northern Virginia Community College', 'VA', 'US', 'America/New_York'),
    ('gmu', 'GMU', 'George Mason University', 'VA', 'US', 'America/New_York'),
    ('vt',   'VT',   'Virginia Tech',                     'VA', 'US', 'America/New_York')
ON CONFLICT (slug) DO UPDATE
SET
    short_code   = EXCLUDED.short_code,
    display_name = EXCLUDED.display_name,
    state_code   = EXCLUDED.state_code,
    country_code = EXCLUDED.country_code,
    timezone     = EXCLUDED.timezone;

-- 4) Helpful indexes for scoped catalog queries
CREATE INDEX IF NOT EXISTS idx_possible_classes_school_term_course
ON possible_classes(school_id, term_name, subject_code, course_number, course_suffix);

CREATE INDEX IF NOT EXISTS idx_possible_classes_school_term_crn
ON possible_classes(school_id, term_name, crn);

CREATE INDEX IF NOT EXISTS idx_schedules_school_id
ON schedules(school_id);

-- 5) Replace the old uniqueness rule so identical CRNs/meeting blocks can exist across schools
DROP INDEX IF EXISTS possible_classes_term_crn_day_time_unique;

CREATE UNIQUE INDEX IF NOT EXISTS possible_classes_school_term_crn_day_time_unique
ON possible_classes(school_id, term_name, crn, day_of_week, start_time, end_time);

-- 6) RLS for the new taxonomy table, consistent with your public catalog setup
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read schools" ON schools;

CREATE POLICY "public read schools"
ON schools
FOR SELECT
TO anon, authenticated
USING (true);

COMMIT;
