-- Implement ADR 0007 catalog section persistence.

BEGIN;

CREATE TABLE IF NOT EXISTS catalog_sections (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id      UUID        NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
    subject_code    TEXT        NOT NULL,
    course_number   INTEGER     NOT NULL CHECK (course_number >= 0 AND course_number <= 9999),
    section_code    TEXT,
    crn             TEXT,
    instructor_name TEXT,
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    source_metadata JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_section_meetings (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID    NOT NULL REFERENCES catalog_sections(id) ON DELETE CASCADE,
    days       TEXT    NOT NULL,
    start_time TIME    NOT NULL,
    end_time   TIME    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT catalog_section_meetings_time_order
        CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_catalog_sections_catalog_id
ON catalog_sections(catalog_id);

CREATE INDEX IF NOT EXISTS idx_catalog_sections_course
ON catalog_sections(catalog_id, subject_code, course_number);

CREATE INDEX IF NOT EXISTS idx_catalog_sections_crn
ON catalog_sections(catalog_id, crn);

CREATE INDEX IF NOT EXISTS idx_catalog_section_meetings_section_id
ON catalog_section_meetings(section_id);

COMMIT;
