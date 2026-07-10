BEGIN;

CREATE TABLE IF NOT EXISTS public.catalog_instructor_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID NOT NULL
        REFERENCES public.catalogs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    instructor_name TEXT NOT NULL,
    normalized_instructor_name TEXT NOT NULL,
    preference_score NUMERIC CHECK (
        preference_score IS NULL
        OR (preference_score >= 0 AND preference_score <= 5)
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT catalog_instructor_preferences_instructor_name_length
        CHECK (
            char_length(instructor_name) BETWEEN 1 AND 200
        ),
    CONSTRAINT catalog_instructor_preferences_normalized_name_length
        CHECK (
            char_length(normalized_instructor_name) BETWEEN 1 AND 200
        ),
    CONSTRAINT catalog_instructor_preferences_catalog_user_name_unique
        UNIQUE (catalog_id, user_id, normalized_instructor_name)
);

CREATE INDEX IF NOT EXISTS idx_catalog_instructor_preferences_catalog
ON public.catalog_instructor_preferences(catalog_id);

CREATE INDEX IF NOT EXISTS idx_catalog_instructor_preferences_user
ON public.catalog_instructor_preferences(user_id);

ALTER TABLE public.catalog_instructor_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_instructor_preferences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own catalog instructor preferences"
ON public.catalog_instructor_preferences;
DROP POLICY IF EXISTS "users insert own catalog instructor preferences"
ON public.catalog_instructor_preferences;
DROP POLICY IF EXISTS "users update own catalog instructor preferences"
ON public.catalog_instructor_preferences;
DROP POLICY IF EXISTS "users delete own catalog instructor preferences"
ON public.catalog_instructor_preferences;

CREATE POLICY "users read own catalog instructor preferences"
ON public.catalog_instructor_preferences
FOR SELECT
TO authenticated
USING (
    catalog_instructor_preferences.user_id = (SELECT auth.uid())
);

CREATE POLICY "users insert own catalog instructor preferences"
ON public.catalog_instructor_preferences
FOR INSERT
TO authenticated
WITH CHECK (
    catalog_instructor_preferences.user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_instructor_preferences.catalog_id
          AND (
              c.created_by = (SELECT auth.uid())
              OR c.status = 'published'
              OR c.source_type = 'demo'
          )
    )
);

CREATE POLICY "users update own catalog instructor preferences"
ON public.catalog_instructor_preferences
FOR UPDATE
TO authenticated
USING (
    catalog_instructor_preferences.user_id = (SELECT auth.uid())
)
WITH CHECK (
    catalog_instructor_preferences.user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_instructor_preferences.catalog_id
          AND (
              c.created_by = (SELECT auth.uid())
              OR c.status = 'published'
              OR c.source_type = 'demo'
          )
    )
);

CREATE POLICY "users delete own catalog instructor preferences"
ON public.catalog_instructor_preferences
FOR DELETE
TO authenticated
USING (
    catalog_instructor_preferences.user_id = (SELECT auth.uid())
);

REVOKE ALL PRIVILEGES ON TABLE public.catalog_instructor_preferences
FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.catalog_instructor_preferences
TO authenticated;

COMMENT ON TABLE public.catalog_instructor_preferences IS
'User-owned instructor preference scores for a catalog. These are schedule-planning preferences, not catalog section facts.';

COMMENT ON COLUMN public.catalog_instructor_preferences.preference_score IS
'Optional user-entered score from 0 to 5. Null scores are equivalent to no saved preference.';

COMMIT;
