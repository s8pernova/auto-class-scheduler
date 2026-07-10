BEGIN;

CREATE TABLE IF NOT EXISTS public.catalog_instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID NOT NULL
        REFERENCES public.catalogs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT catalog_instructors_name_length
        CHECK (char_length(name) BETWEEN 1 AND 200),
    CONSTRAINT catalog_instructors_normalized_name_length
        CHECK (char_length(normalized_name) BETWEEN 1 AND 200),
    CONSTRAINT catalog_instructors_catalog_name_unique
        UNIQUE (catalog_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_catalog_instructors_catalog
ON public.catalog_instructors(catalog_id);

INSERT INTO public.catalog_instructors (
    catalog_id,
    name,
    normalized_name
)
SELECT DISTINCT
    cs.catalog_id,
    btrim(regexp_replace(csm.instructor_name, '\s+', ' ', 'g')) AS name,
    lower(btrim(regexp_replace(csm.instructor_name, '\s+', ' ', 'g')))
        AS normalized_name
FROM public.catalog_section_meetings csm
JOIN public.catalog_sections cs ON cs.id = csm.section_id
WHERE nullif(btrim(regexp_replace(csm.instructor_name, '\s+', ' ', 'g')), '')
    IS NOT NULL
ON CONFLICT (catalog_id, normalized_name) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = now();

INSERT INTO public.catalog_instructors (
    catalog_id,
    name,
    normalized_name
)
SELECT DISTINCT
    cip.catalog_id,
    btrim(regexp_replace(cip.instructor_name, '\s+', ' ', 'g')) AS name,
    lower(btrim(regexp_replace(cip.instructor_name, '\s+', ' ', 'g')))
        AS normalized_name
FROM public.catalog_instructor_preferences cip
WHERE nullif(btrim(regexp_replace(cip.instructor_name, '\s+', ' ', 'g')), '')
    IS NOT NULL
ON CONFLICT (catalog_id, normalized_name) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = now();

ALTER TABLE public.catalog_section_meetings
ADD COLUMN IF NOT EXISTS instructor_id UUID
    REFERENCES public.catalog_instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_section_meetings_instructor
ON public.catalog_section_meetings(instructor_id);

UPDATE public.catalog_section_meetings csm
SET instructor_id = ci.id
FROM public.catalog_sections cs
JOIN public.catalog_instructors ci ON ci.catalog_id = cs.catalog_id
WHERE cs.id = csm.section_id
  AND lower(btrim(regexp_replace(csm.instructor_name, '\s+', ' ', 'g')))
      = ci.normalized_name
  AND csm.instructor_id IS NULL;

ALTER TABLE public.catalog_instructor_preferences
ADD COLUMN IF NOT EXISTS instructor_id UUID;

UPDATE public.catalog_instructor_preferences cip
SET instructor_id = ci.id
FROM public.catalog_instructors ci
WHERE ci.catalog_id = cip.catalog_id
  AND ci.normalized_name = lower(
      btrim(regexp_replace(cip.instructor_name, '\s+', ' ', 'g'))
  )
  AND cip.instructor_id IS NULL;

DROP POLICY IF EXISTS "users read own catalog instructor preferences"
ON public.catalog_instructor_preferences;
DROP POLICY IF EXISTS "users insert own catalog instructor preferences"
ON public.catalog_instructor_preferences;
DROP POLICY IF EXISTS "users update own catalog instructor preferences"
ON public.catalog_instructor_preferences;
DROP POLICY IF EXISTS "users delete own catalog instructor preferences"
ON public.catalog_instructor_preferences;

DELETE FROM public.catalog_instructor_preferences
WHERE instructor_id IS NULL
   OR preference_score IS NULL;

DROP INDEX IF EXISTS public.idx_catalog_instructor_preferences_catalog;

ALTER TABLE public.catalog_instructor_preferences
DROP CONSTRAINT IF EXISTS catalog_instructor_preferences_catalog_user_name_unique,
DROP CONSTRAINT IF EXISTS catalog_instructor_preferences_instructor_name_length,
DROP CONSTRAINT IF EXISTS catalog_instructor_preferences_normalized_name_length,
DROP COLUMN IF EXISTS catalog_id,
DROP COLUMN IF EXISTS instructor_name,
DROP COLUMN IF EXISTS normalized_instructor_name;

ALTER TABLE public.catalog_instructor_preferences
ALTER COLUMN instructor_id SET NOT NULL,
ALTER COLUMN preference_score SET NOT NULL,
ADD CONSTRAINT catalog_instructor_preferences_instructor_id_fkey
    FOREIGN KEY (instructor_id)
    REFERENCES public.catalog_instructors(id)
    ON DELETE CASCADE,
ADD CONSTRAINT catalog_instructor_preferences_user_instructor_unique
    UNIQUE (user_id, instructor_id);

CREATE INDEX IF NOT EXISTS idx_catalog_instructor_preferences_instructor
ON public.catalog_instructor_preferences(instructor_id);

DROP TRIGGER IF EXISTS validate_catalog_section_meeting_instructor_trigger
ON public.catalog_section_meetings;
DROP FUNCTION IF EXISTS public.validate_catalog_section_meeting_instructor();

CREATE FUNCTION public.validate_catalog_section_meeting_instructor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.instructor_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.catalog_sections cs
        JOIN public.catalog_instructors ci ON ci.id = NEW.instructor_id
        WHERE ci.catalog_id = cs.catalog_id
          AND cs.id = NEW.section_id
    ) THEN
        RAISE EXCEPTION
            'Instructor % does not belong to meeting section catalog',
            NEW.instructor_id
            USING ERRCODE = '23503';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_catalog_section_meeting_instructor()
FROM PUBLIC;

CREATE TRIGGER validate_catalog_section_meeting_instructor_trigger
BEFORE INSERT OR UPDATE OF section_id, instructor_id
ON public.catalog_section_meetings
FOR EACH ROW
EXECUTE FUNCTION public.validate_catalog_section_meeting_instructor();

ALTER TABLE public.catalog_section_meetings
DROP CONSTRAINT IF EXISTS catalog_section_meetings_instructor_name_length,
DROP COLUMN IF EXISTS instructor_name;

ALTER TABLE public.catalog_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_instructors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read accessible catalog_instructors"
ON public.catalog_instructors;
DROP POLICY IF EXISTS "anon read public catalog_instructors"
ON public.catalog_instructors;
DROP POLICY IF EXISTS "users insert writable catalog_instructors"
ON public.catalog_instructors;
DROP POLICY IF EXISTS "users update writable catalog_instructors"
ON public.catalog_instructors;
DROP POLICY IF EXISTS "users delete writable catalog_instructors"
ON public.catalog_instructors;

CREATE POLICY "authenticated read accessible catalog_instructors"
ON public.catalog_instructors
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_instructors.catalog_id
          AND (
              c.created_by = (SELECT auth.uid())
              OR c.status = 'published'
              OR c.source_type = 'demo'
          )
    )
);

CREATE POLICY "anon read public catalog_instructors"
ON public.catalog_instructors
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_instructors.catalog_id
          AND (
              c.status = 'published'
              OR c.source_type = 'demo'
          )
    )
);

CREATE POLICY "users insert writable catalog_instructors"
ON public.catalog_instructors
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_instructors.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

CREATE POLICY "users update writable catalog_instructors"
ON public.catalog_instructors
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_instructors.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_instructors.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

CREATE POLICY "users delete writable catalog_instructors"
ON public.catalog_instructors
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_instructors.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

ALTER TABLE public.catalog_instructor_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_instructor_preferences FORCE ROW LEVEL SECURITY;

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
        FROM public.catalog_instructors ci
        JOIN public.catalogs c ON c.id = ci.catalog_id
        WHERE ci.id = catalog_instructor_preferences.instructor_id
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
        FROM public.catalog_instructors ci
        JOIN public.catalogs c ON c.id = ci.catalog_id
        WHERE ci.id = catalog_instructor_preferences.instructor_id
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

REVOKE ALL PRIVILEGES ON TABLE public.catalog_instructors
FROM anon, authenticated;
GRANT SELECT
ON TABLE public.catalog_instructors
TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.catalog_instructors
TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.catalog_instructor_preferences
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.catalog_instructor_preferences
TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_catalog_sections(
    p_catalog_id UUID,
    p_sections JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    section_record JSONB;
    meeting_record JSONB;
    new_section_id UUID;
    section_index INTEGER := 0;
    meeting_index INTEGER;
    section_count INTEGER := 0;
    normalized_course_name TEXT;
    instructor_name TEXT;
    normalized_instructor_name TEXT;
    resolved_instructor_id UUID;
BEGIN
    IF p_sections IS NULL OR jsonb_typeof(p_sections) <> 'array' THEN
        RAISE EXCEPTION 'p_sections must be a JSON array'
            USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM public.catalogs
    WHERE id = p_catalog_id
      AND created_by = (SELECT auth.uid())
      AND source_type <> 'demo'
      AND status <> 'published'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog % not found or not writable', p_catalog_id
            USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.catalog_sections
    WHERE catalog_id = p_catalog_id;

    FOR section_record IN
        SELECT value FROM jsonb_array_elements(p_sections)
    LOOP
        section_index := section_index + 1;
        meeting_index := 0;
        normalized_course_name := nullif(
            btrim(regexp_replace(section_record ->> 'course_name', '\s+', ' ', 'g')),
            ''
        );

        IF normalized_course_name IS NULL THEN
            RAISE EXCEPTION 'Each catalog section must include course_name'
                USING ERRCODE = '22023';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.catalog_sections
            WHERE catalog_id = p_catalog_id
              AND course_name = normalized_course_name
        ) THEN
            RAISE EXCEPTION 'Duplicate course_name: %', normalized_course_name
                USING ERRCODE = '23505';
        END IF;

        IF jsonb_typeof(section_record -> 'meetings') <> 'array'
           OR jsonb_array_length(section_record -> 'meetings') = 0 THEN
            RAISE EXCEPTION 'Each catalog section must include at least one meeting'
                USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.catalog_sections (
            catalog_id,
            course_name,
            sort_order,
            source_metadata
        )
        VALUES (
            p_catalog_id,
            normalized_course_name,
            COALESCE((section_record ->> 'sort_order')::INTEGER, section_index - 1),
            COALESCE(section_record -> 'source_metadata', '{}'::jsonb)
        )
        RETURNING id INTO new_section_id;

        section_count := section_count + 1;

        FOR meeting_record IN
            SELECT value FROM jsonb_array_elements(section_record -> 'meetings')
        LOOP
            meeting_index := meeting_index + 1;

            IF COALESCE(meeting_record ->> 'days', '') !~ '^[MTWRFS]+$' THEN
                RAISE EXCEPTION 'Meeting days must use M, T, W, R, F, or S'
                    USING ERRCODE = '22023';
            END IF;

            instructor_name := nullif(
                btrim(
                    regexp_replace(
                        COALESCE(meeting_record ->> 'instructor_name', ''),
                        '\s+',
                        ' ',
                        'g'
                    )
                ),
                ''
            );
            normalized_instructor_name := lower(instructor_name);
            resolved_instructor_id := NULL;

            IF instructor_name IS NOT NULL THEN
                INSERT INTO public.catalog_instructors (
                    catalog_id,
                    name,
                    normalized_name
                )
                VALUES (
                    p_catalog_id,
                    instructor_name,
                    normalized_instructor_name
                )
                ON CONFLICT (catalog_id, normalized_name) DO UPDATE
                SET name = EXCLUDED.name,
                    updated_at = now()
                RETURNING id INTO resolved_instructor_id;
            END IF;

            INSERT INTO public.catalog_section_meetings (
                section_id,
                crn,
                instructor_id,
                days,
                start_time,
                end_time,
                sort_order
            )
            VALUES (
                new_section_id,
                nullif(meeting_record ->> 'crn', ''),
                resolved_instructor_id,
                meeting_record ->> 'days',
                (meeting_record ->> 'start_time')::TIME,
                (meeting_record ->> 'end_time')::TIME,
                COALESCE((meeting_record ->> 'sort_order')::INTEGER, meeting_index - 1)
            );
        END LOOP;
    END LOOP;

    DELETE FROM public.catalog_instructors ci
    WHERE ci.catalog_id = p_catalog_id
      AND NOT EXISTS (
          SELECT 1
          FROM public.catalog_section_meetings csm
          JOIN public.catalog_sections cs ON cs.id = csm.section_id
          WHERE cs.catalog_id = p_catalog_id
            AND csm.instructor_id = ci.id
      );

    UPDATE public.catalogs
    SET row_count = section_count,
        status = CASE WHEN section_count > 0 THEN 'ready' ELSE 'draft' END,
        updated_at = now()
    WHERE id = p_catalog_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_catalog_sections(UUID, JSONB)
TO authenticated;

COMMENT ON TABLE public.catalog_instructors IS
'Catalog-scoped instructor taxonomy resolved from committed catalog meeting rows.';

COMMENT ON COLUMN public.catalog_section_meetings.instructor_id IS
'Optional catalog instructor assigned to this candidate meeting row.';

COMMENT ON TABLE public.catalog_instructor_preferences IS
'User-owned instructor preference scores keyed by catalog instructor identity.';

COMMENT ON COLUMN public.catalog_instructor_preferences.preference_score IS
'User-entered score from 0 to 5. Missing rows represent unrated instructors.';

COMMIT;
