BEGIN;

-- This migration assumes Virginia Tech already exists as school id 3.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM schools
        WHERE id = 3
    ) THEN
        RAISE EXCEPTION 'Expected schools.id = 3 to exist for Virginia Tech before running this migration';
    END IF;
END $$;

-- Add school scoping to possible classes if it is not already present.
ALTER TABLE possible_classes
ADD COLUMN IF NOT EXISTS school_id BIGINT;

-- Backfill all existing rows to Virginia Tech.
UPDATE possible_classes
SET school_id = 3
WHERE school_id IS NULL;

-- Enforce the foreign key once the data is backfilled.
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

-- At this stage every existing possible_class row should belong to a school.
ALTER TABLE possible_classes
ALTER COLUMN school_id SET NOT NULL;

-- Helpful lookup index.
CREATE INDEX IF NOT EXISTS idx_possible_classes_school_id
ON possible_classes(school_id);

-- Replace the old school-blind uniqueness rule with a school-scoped one.
DROP INDEX IF EXISTS possible_classes_term_crn_day_time_unique;

CREATE UNIQUE INDEX IF NOT EXISTS possible_classes_school_term_crn_day_time_unique
ON possible_classes(school_id, term_name, crn, day_of_week, start_time, end_time);

COMMIT;
