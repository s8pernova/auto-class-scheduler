BEGIN;

-- Rename tables
ALTER TABLE IF EXISTS schedules RENAME TO saved_schedules;
ALTER TABLE IF EXISTS schedule_sections RENAME TO saved_schedule_sections;

-- Rename primary keys and standard sequences if they exist
ALTER SEQUENCE IF EXISTS schedules_id_seq RENAME TO saved_schedules_id_seq;
ALTER INDEX IF EXISTS schedules_pkey RENAME TO saved_schedules_pkey;
ALTER INDEX IF EXISTS schedule_sections_pkey RENAME TO saved_schedule_sections_pkey;

-- Rename custom indexes
ALTER INDEX IF EXISTS idx_schedules_school_id RENAME TO idx_saved_schedules_school_id;

-- Add user_id, term_name, schedule_hash to saved_schedules
ALTER TABLE saved_schedules
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS term_name TEXT,
ADD COLUMN IF NOT EXISTS schedule_hash TEXT;

-- Create unique constraint for user + school + term + hash to prevent duplicate saves
CREATE UNIQUE INDEX IF NOT EXISTS saved_schedules_fingerprint_idx 
ON saved_schedules(user_id, school_id, term_name, schedule_hash);

-- Update RLS Policies
-- Drop old public policies for schedules and schedule_sections
DROP POLICY IF EXISTS "public read schedules" ON saved_schedules;
DROP POLICY IF EXISTS "public read schedule_sections" ON saved_schedule_sections;

-- Create new user-scoped policies for saved_schedules
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

-- Create new user-scoped policies for saved_schedule_sections
CREATE POLICY "users read own saved_schedule_sections"
ON saved_schedule_sections
FOR SELECT
TO authenticated
USING (
    schedule_id IN (
        SELECT id FROM saved_schedules WHERE user_id = (select auth.uid())
    )
);

CREATE POLICY "users insert own saved_schedule_sections"
ON saved_schedule_sections
FOR INSERT
TO authenticated
WITH CHECK (
    schedule_id IN (
        SELECT id FROM saved_schedules WHERE user_id = (select auth.uid())
    )
);

CREATE POLICY "users update own saved_schedule_sections"
ON saved_schedule_sections
FOR UPDATE
TO authenticated
USING (
    schedule_id IN (
        SELECT id FROM saved_schedules WHERE user_id = (select auth.uid())
    )
)
WITH CHECK (
    schedule_id IN (
        SELECT id FROM saved_schedules WHERE user_id = (select auth.uid())
    )
);

CREATE POLICY "users delete own saved_schedule_sections"
ON saved_schedule_sections
FOR DELETE
TO authenticated
USING (
    schedule_id IN (
        SELECT id FROM saved_schedules WHERE user_id = (select auth.uid())
    )
);

-- Skipping `ALTER COLUMN user_id SET NOT NULL` to avoid breaking existing dev data

COMMIT;
