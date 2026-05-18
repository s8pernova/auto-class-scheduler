BEGIN;

-- Rename tables
ALTER TABLE IF EXISTS schedules RENAME TO saved_schedules;
ALTER TABLE IF EXISTS schedule_sections RENAME TO saved_schedule_sections;

-- Rename sequence / indexes if they exist
ALTER SEQUENCE IF EXISTS schedules_id_seq RENAME TO saved_schedules_id_seq;
ALTER INDEX IF EXISTS schedules_pkey RENAME TO saved_schedules_pkey;
ALTER INDEX IF EXISTS schedule_sections_pkey RENAME TO saved_schedule_sections_pkey;
ALTER INDEX IF EXISTS idx_schedules_school_id RENAME TO idx_saved_schedules_school_id;

-- Optional but cleaner: rename old foreign key constraints if they exist
ALTER TABLE IF EXISTS saved_schedule_sections
RENAME CONSTRAINT schedule_sections_schedule_id_fkey TO saved_schedule_sections_schedule_id_fkey;

ALTER TABLE IF EXISTS favorites
RENAME CONSTRAINT favorites_schedule_id_fkey TO favorites_saved_schedule_id_fkey;

ALTER TABLE IF EXISTS saved_schedules
RENAME CONSTRAINT schedules_school_id_fkey TO saved_schedules_school_id_fkey;

-- Add saved-schedule ownership and fingerprint fields
ALTER TABLE saved_schedules
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS term_name TEXT,
ADD COLUMN IF NOT EXISTS schedule_hash TEXT;

-- During dev, keep columns nullable, but only enforce uniqueness for complete fingerprints.
CREATE UNIQUE INDEX IF NOT EXISTS saved_schedules_fingerprint_idx
ON saved_schedules(user_id, school_id, term_name, schedule_hash)
WHERE user_id IS NOT NULL
  AND school_id IS NOT NULL
  AND term_name IS NOT NULL
  AND schedule_hash IS NOT NULL;

-- Make RLS state explicit
ALTER TABLE saved_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_schedules FORCE ROW LEVEL SECURITY;

ALTER TABLE saved_schedule_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_schedule_sections FORCE ROW LEVEL SECURITY;

-- Drop old public policies that were attached before rename
DROP POLICY IF EXISTS "public read schedules" ON saved_schedules;
DROP POLICY IF EXISTS "public read schedule_sections" ON saved_schedule_sections;

-- Drop new policies too so this migration can rerun cleanly in dev
DROP POLICY IF EXISTS "users read own saved_schedules" ON saved_schedules;
DROP POLICY IF EXISTS "users insert own saved_schedules" ON saved_schedules;
DROP POLICY IF EXISTS "users update own saved_schedules" ON saved_schedules;
DROP POLICY IF EXISTS "users delete own saved_schedules" ON saved_schedules;

DROP POLICY IF EXISTS "users read own saved_schedule_sections" ON saved_schedule_sections;
DROP POLICY IF EXISTS "users insert own saved_schedule_sections" ON saved_schedule_sections;
DROP POLICY IF EXISTS "users update own saved_schedule_sections" ON saved_schedule_sections;
DROP POLICY IF EXISTS "users delete own saved_schedule_sections" ON saved_schedule_sections;

-- User-scoped saved_schedules policies
CREATE POLICY "users read own saved_schedules"
ON saved_schedules
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "users insert own saved_schedules"
ON saved_schedules
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "users update own saved_schedules"
ON saved_schedules
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "users delete own saved_schedules"
ON saved_schedules
FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);

-- User-scoped saved_schedule_sections policies
CREATE POLICY "users read own saved_schedule_sections"
ON saved_schedule_sections
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM saved_schedules ss
        WHERE ss.id = saved_schedule_sections.schedule_id
          AND ss.user_id = (select auth.uid())
    )
);

CREATE POLICY "users insert own saved_schedule_sections"
ON saved_schedule_sections
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM saved_schedules ss
        WHERE ss.id = saved_schedule_sections.schedule_id
          AND ss.user_id = (select auth.uid())
    )
);

CREATE POLICY "users update own saved_schedule_sections"
ON saved_schedule_sections
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM saved_schedules ss
        WHERE ss.id = saved_schedule_sections.schedule_id
          AND ss.user_id = (select auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM saved_schedules ss
        WHERE ss.id = saved_schedule_sections.schedule_id
          AND ss.user_id = (select auth.uid())
    )
);

CREATE POLICY "users delete own saved_schedule_sections"
ON saved_schedule_sections
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM saved_schedules ss
        WHERE ss.id = saved_schedule_sections.schedule_id
          AND ss.user_id = (select auth.uid())
    )
);

-- Explicit PostgREST grants for renamed tables
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_schedule_sections TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE saved_schedules_id_seq TO authenticated;

COMMIT;