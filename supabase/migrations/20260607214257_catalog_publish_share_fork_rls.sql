BEGIN;

ALTER TABLE public.catalogs
DROP CONSTRAINT IF EXISTS catalogs_status_check,
ADD CONSTRAINT catalogs_status_check
    CHECK (status IN ('draft', 'ready', 'published', 'error', 'archived'));

ALTER TABLE public.catalogs
ADD COLUMN IF NOT EXISTS share_slug TEXT,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS forked_from_catalog_id UUID
    REFERENCES public.catalogs(id) ON DELETE SET NULL;

ALTER TABLE public.catalogs
DROP CONSTRAINT IF EXISTS catalogs_share_slug_format,
ADD CONSTRAINT catalogs_share_slug_format
    CHECK (
        share_slug IS NULL
        OR share_slug ~ '^[a-z0-9_-]{8,64}$'
    );

ALTER TABLE public.catalogs
DROP CONSTRAINT IF EXISTS catalogs_published_share_fields,
ADD CONSTRAINT catalogs_published_share_fields
    CHECK (
        status <> 'published'
        OR (share_slug IS NOT NULL AND published_at IS NOT NULL)
    );

ALTER TABLE public.catalogs
DROP CONSTRAINT IF EXISTS catalogs_fork_not_self,
ADD CONSTRAINT catalogs_fork_not_self
    CHECK (
        forked_from_catalog_id IS NULL
        OR forked_from_catalog_id <> id
    );

CREATE UNIQUE INDEX IF NOT EXISTS catalogs_share_slug_unique_idx
ON public.catalogs(share_slug)
WHERE share_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalogs_forked_from_catalog_id
ON public.catalogs(forked_from_catalog_id);

COMMENT ON COLUMN public.catalogs.share_slug IS
'Public share identifier for published catalog snapshots.';

COMMENT ON COLUMN public.catalogs.published_at IS
'Timestamp when a catalog became an immutable published snapshot.';

COMMENT ON COLUMN public.catalogs.forked_from_catalog_id IS
'Source published catalog when this catalog was forked into a new draft.';

DROP POLICY IF EXISTS "users read own catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "users insert own catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "users update own catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "users delete own catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "anyone can read demo catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "authenticated read accessible catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "anon read demo catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "anon read public catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "users insert draft catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "users update writable catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "users delete writable catalogs" ON public.catalogs;

CREATE POLICY "authenticated read accessible catalogs"
ON public.catalogs
FOR SELECT
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    OR source_type = 'demo'
    OR status = 'published'
);

CREATE POLICY "anon read public catalogs"
ON public.catalogs
FOR SELECT
TO anon
USING (
    source_type = 'demo'
    OR status = 'published'
);

CREATE POLICY "users insert draft catalogs"
ON public.catalogs
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = (SELECT auth.uid())
    AND source_type <> 'demo'
    AND status IN ('draft', 'ready')
);

CREATE POLICY "users update writable catalogs"
ON public.catalogs
FOR UPDATE
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    AND source_type <> 'demo'
    AND status <> 'published'
)
WITH CHECK (
    created_by = (SELECT auth.uid())
    AND source_type <> 'demo'
);

CREATE POLICY "users delete writable catalogs"
ON public.catalogs
FOR DELETE
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    AND source_type <> 'demo'
    AND status <> 'published'
);

DROP POLICY IF EXISTS "users read own catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "users insert own catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "users update own catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "users delete own catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "anyone can read demo catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "authenticated read accessible catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "anon read demo catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "anon read public catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "users insert writable catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "users update writable catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "users delete writable catalog_sections" ON public.catalog_sections;

CREATE POLICY "authenticated read accessible catalog_sections"
ON public.catalog_sections
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND (
              c.created_by = (SELECT auth.uid())
              OR c.source_type = 'demo'
              OR c.status = 'published'
          )
    )
);

CREATE POLICY "anon read public catalog_sections"
ON public.catalog_sections
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND (
              c.source_type = 'demo'
              OR c.status = 'published'
          )
    )
);

CREATE POLICY "users insert writable catalog_sections"
ON public.catalog_sections
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

CREATE POLICY "users update writable catalog_sections"
ON public.catalog_sections
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

CREATE POLICY "users delete writable catalog_sections"
ON public.catalog_sections
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

DROP POLICY IF EXISTS "users read own catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "users insert own catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "users update own catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "users delete own catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "anyone can read demo catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "authenticated read accessible catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "anon read demo catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "anon read public catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "users insert writable catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "users update writable catalog_section_meetings" ON public.catalog_section_meetings;
DROP POLICY IF EXISTS "users delete writable catalog_section_meetings" ON public.catalog_section_meetings;

CREATE POLICY "authenticated read accessible catalog_section_meetings"
ON public.catalog_section_meetings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalog_sections cs
        JOIN public.catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND (
              c.created_by = (SELECT auth.uid())
              OR c.source_type = 'demo'
              OR c.status = 'published'
          )
    )
);

CREATE POLICY "anon read public catalog_section_meetings"
ON public.catalog_section_meetings
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM public.catalog_sections cs
        JOIN public.catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND (
              c.source_type = 'demo'
              OR c.status = 'published'
          )
    )
);

CREATE POLICY "users insert writable catalog_section_meetings"
ON public.catalog_section_meetings
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.catalog_sections cs
        JOIN public.catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

CREATE POLICY "users update writable catalog_section_meetings"
ON public.catalog_section_meetings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalog_sections cs
        JOIN public.catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.catalog_sections cs
        JOIN public.catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

CREATE POLICY "users delete writable catalog_section_meetings"
ON public.catalog_section_meetings
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.catalog_sections cs
        JOIN public.catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
          AND c.status <> 'published'
    )
);

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
        normalized_course_name := nullif(btrim(section_record ->> 'course_name'), '');

        IF normalized_course_name IS NULL THEN
            RAISE EXCEPTION 'Each catalog section must include course_name'
                USING ERRCODE = '22023';
        END IF;

        IF jsonb_typeof(section_record -> 'meetings') <> 'array'
           OR jsonb_array_length(section_record -> 'meetings') = 0 THEN
            RAISE EXCEPTION 'Each catalog section must include at least one meeting'
                USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.catalog_sections (
            catalog_id,
            course_name,
            crn,
            instructor_name,
            sort_order,
            source_metadata
        )
        VALUES (
            p_catalog_id,
            normalized_course_name,
            nullif(section_record ->> 'crn', ''),
            nullif(section_record ->> 'instructor_name', ''),
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

            INSERT INTO public.catalog_section_meetings (
                section_id,
                days,
                start_time,
                end_time,
                sort_order
            )
            VALUES (
                new_section_id,
                meeting_record ->> 'days',
                (meeting_record ->> 'start_time')::TIME,
                (meeting_record ->> 'end_time')::TIME,
                COALESCE((meeting_record ->> 'sort_order')::INTEGER, meeting_index - 1)
            );
        END LOOP;
    END LOOP;

    UPDATE public.catalogs
    SET row_count = section_count,
        status = CASE WHEN section_count > 0 THEN 'ready' ELSE 'draft' END,
        updated_at = now()
    WHERE id = p_catalog_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_catalog_sections(UUID, JSONB) TO authenticated;

COMMIT;
