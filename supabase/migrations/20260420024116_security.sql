BEGIN;

-- 1) Add ownership to favorites
ALTER TABLE favorites
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- If this table already has data, do not make user_id NOT NULL until you backfill or clear old rows.
-- After backfill, run a later migration:
-- ALTER TABLE favorites ALTER COLUMN user_id SET NOT NULL;

-- Replace the wrong global uniqueness rule with per-user uniqueness
ALTER TABLE favorites
DROP CONSTRAINT IF EXISTS favorites_schedule_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_schedule_unique
ON favorites(user_id, schedule_id);

-- 2) Enable RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE possible_classes ENABLE ROW LEVEL SECURITY;

-- Optional, stricter
ALTER TABLE schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE favorites FORCE ROW LEVEL SECURITY;
ALTER TABLE schedule_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE possible_classes FORCE ROW LEVEL SECURITY;

-- 3) Drop old policies if you rerun locally
DROP POLICY IF EXISTS "public read schedules" ON schedules;
DROP POLICY IF EXISTS "public read schedule_sections" ON schedule_sections;
DROP POLICY IF EXISTS "public read possible_classes" ON possible_classes;

DROP POLICY IF EXISTS "users read own favorites" ON favorites;
DROP POLICY IF EXISTS "users insert own favorites" ON favorites;
DROP POLICY IF EXISTS "users delete own favorites" ON favorites;
DROP POLICY IF EXISTS "users update own favorites" ON favorites;

-- 4) Public read-only policies for catalog data
CREATE POLICY "public read schedules"
ON schedules
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "public read schedule_sections"
ON schedule_sections
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "public read possible_classes"
ON possible_classes
FOR SELECT
TO anon, authenticated
USING (true);

-- 5) User-owned favorites policies
CREATE POLICY "users read own favorites"
ON favorites
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "users insert own favorites"
ON favorites
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "users delete own favorites"
ON favorites
FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "users update own favorites"
ON favorites
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

COMMIT;