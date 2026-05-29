-- Implement ADR 0009.
--
-- Retire the school-seeded catalog tables while preserving product-owned saved
-- schedules and favorites. Avoid CASCADE so any unexpected dependency fails the
-- migration instead of being silently removed.

BEGIN;

-- Favorites are user-owned data. Rename the storage table, but keep API route
-- naming as an application concern.
DO $$
BEGIN
    IF to_regclass('public.favorites') IS NOT NULL
       AND to_regclass('public.user_favorites') IS NULL THEN
        ALTER TABLE public.favorites RENAME TO user_favorites;
    END IF;
END $$;

ALTER SEQUENCE IF EXISTS public.favorites_id_seq
RENAME TO user_favorites_id_seq;

ALTER INDEX IF EXISTS public.favorites_pkey
RENAME TO user_favorites_pkey;

ALTER INDEX IF EXISTS public.idx_favorites_schedule_id
RENAME TO idx_user_favorites_schedule_id;

ALTER INDEX IF EXISTS public.idx_favorites_favorited_at
RENAME TO idx_user_favorites_favorited_at;

ALTER INDEX IF EXISTS public.favorites_user_schedule_unique
RENAME TO user_favorites_user_schedule_unique;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = to_regclass('public.user_favorites')
          AND conname = 'favorites_saved_schedule_id_fkey'
    ) THEN
        ALTER TABLE public.user_favorites
        RENAME CONSTRAINT favorites_saved_schedule_id_fkey
        TO user_favorites_saved_schedule_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = to_regclass('public.user_favorites')
          AND conname = 'favorites_user_id_fkey'
    ) THEN
        ALTER TABLE public.user_favorites
        RENAME CONSTRAINT favorites_user_id_fkey
        TO user_favorites_user_id_fkey;
    END IF;
END $$;

ALTER SEQUENCE IF EXISTS public.user_favorites_id_seq
OWNED BY public.user_favorites.id;

-- Keep grants aligned with the renamed user-owned table.
REVOKE ALL PRIVILEGES ON TABLE public.user_favorites FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_favorites TO authenticated;

DO $$
BEGIN
    IF to_regclass('public.user_favorites_id_seq') IS NOT NULL THEN
        REVOKE ALL PRIVILEGES ON SEQUENCE public.user_favorites_id_seq FROM anon;
        GRANT USAGE, SELECT ON SEQUENCE public.user_favorites_id_seq TO authenticated;
    END IF;
END $$;

-- Move saved schedules away from the retired school lookup dependency while
-- preserving any existing school IDs as legacy metadata until a data migration
-- can map saved schedules to catalogs.
ALTER TABLE IF EXISTS public.saved_schedules
DROP CONSTRAINT IF EXISTS saved_schedules_school_id_fkey;

ALTER TABLE IF EXISTS public.saved_schedules
DROP CONSTRAINT IF EXISTS schedules_school_id_fkey;

DROP INDEX IF EXISTS public.idx_saved_schedules_school_id;
DROP INDEX IF EXISTS public.saved_schedules_fingerprint_idx;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saved_schedules'
          AND column_name = 'school_id'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saved_schedules'
          AND column_name = 'legacy_school_id'
    ) THEN
        ALTER TABLE public.saved_schedules
        RENAME COLUMN school_id TO legacy_school_id;
    END IF;
END $$;

ALTER TABLE IF EXISTS public.saved_schedules
ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES public.catalogs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_schedules_catalog_id
ON public.saved_schedules(catalog_id);

CREATE UNIQUE INDEX IF NOT EXISTS saved_schedules_fingerprint_idx
ON public.saved_schedules(user_id, catalog_id, schedule_hash)
WHERE user_id IS NOT NULL
  AND catalog_id IS NOT NULL
  AND schedule_hash IS NOT NULL;

COMMENT ON COLUMN public.saved_schedules.legacy_school_id IS
'Legacy school identifier retained after retiring public.schools. Replace with catalog_id when saved schedules are migrated to catalog-scoped data.';

COMMENT ON COLUMN public.saved_schedules.catalog_id IS
'Catalog used to generate this saved schedule.';

ALTER TABLE IF EXISTS public.saved_schedule_sections
ADD COLUMN IF NOT EXISTS catalog_section_id UUID REFERENCES public.catalog_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_schedule_sections_catalog_section_id
ON public.saved_schedule_sections(catalog_section_id);

COMMENT ON COLUMN public.saved_schedule_sections.catalog_section_id IS
'Catalog section selected for this saved schedule row; nullable while legacy saved rows are migrated.';

DROP TABLE IF EXISTS public.possible_classes;
DROP TABLE IF EXISTS public.schools;

COMMIT;
