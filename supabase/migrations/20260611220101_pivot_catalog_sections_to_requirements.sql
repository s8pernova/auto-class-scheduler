-- Make catalog_sections represent requirement/sidebar buckets and
-- catalog_section_meetings represent the editable main-box rows.

BEGIN;

ALTER TABLE public.catalog_section_meetings
ADD COLUMN IF NOT EXISTS crn TEXT,
ADD COLUMN IF NOT EXISTS instructor_name TEXT;

ALTER TABLE public.saved_schedule_sections
ADD COLUMN IF NOT EXISTS catalog_section_meeting_id UUID
    REFERENCES public.catalog_section_meetings(id) ON DELETE SET NULL;

UPDATE public.catalog_section_meetings csm
SET crn = nullif(cs.crn, ''),
    instructor_name = nullif(cs.instructor_name, '')
FROM public.catalog_sections cs
WHERE csm.section_id = cs.id
  AND (
      csm.crn IS NULL
      OR csm.instructor_name IS NULL
  );

CREATE TEMP TABLE _catalog_section_bucket_map ON COMMIT DROP AS
WITH ranked AS (
    SELECT
        id AS old_section_id,
        first_value(id) OVER (
            PARTITION BY catalog_id, course_name
            ORDER BY sort_order, id
        ) AS bucket_section_id
    FROM public.catalog_sections
)
SELECT old_section_id, bucket_section_id
FROM ranked;

CREATE TEMP TABLE _catalog_section_primary_meeting ON COMMIT DROP AS
SELECT old_section_id, meeting_id
FROM (
    SELECT
        csm.section_id AS old_section_id,
        csm.id AS meeting_id,
        row_number() OVER (
            PARTITION BY csm.section_id
            ORDER BY csm.sort_order, csm.id
        ) AS row_number
    FROM public.catalog_section_meetings csm
) ranked_meetings
WHERE row_number = 1;

UPDATE public.saved_schedule_sections sss
SET catalog_section_meeting_id = COALESCE(
        sss.catalog_section_meeting_id,
        pm.meeting_id
    ),
    catalog_section_id = bm.bucket_section_id
FROM _catalog_section_bucket_map bm
LEFT JOIN _catalog_section_primary_meeting pm
    ON pm.old_section_id = bm.old_section_id
WHERE sss.catalog_section_id = bm.old_section_id;

UPDATE public.catalog_section_meetings csm
SET section_id = bm.bucket_section_id
FROM _catalog_section_bucket_map bm
WHERE csm.section_id = bm.old_section_id
  AND csm.section_id <> bm.bucket_section_id;

DELETE FROM public.catalog_sections cs
USING _catalog_section_bucket_map bm
WHERE cs.id = bm.old_section_id
  AND bm.old_section_id <> bm.bucket_section_id;

DROP INDEX IF EXISTS public.idx_catalog_sections_crn;
DROP INDEX IF EXISTS public.idx_catalog_sections_course_name;

ALTER TABLE public.catalog_sections
DROP COLUMN IF EXISTS crn,
DROP COLUMN IF EXISTS instructor_name;

ALTER TABLE public.catalog_section_meetings
DROP CONSTRAINT IF EXISTS catalog_section_meetings_crn_length,
DROP CONSTRAINT IF EXISTS catalog_section_meetings_instructor_name_length,
ADD CONSTRAINT catalog_section_meetings_crn_length
    CHECK (crn IS NULL OR char_length(crn) <= 50),
ADD CONSTRAINT catalog_section_meetings_instructor_name_length
    CHECK (instructor_name IS NULL OR char_length(instructor_name) <= 200);

ALTER TABLE public.catalog_sections
DROP CONSTRAINT IF EXISTS catalog_sections_catalog_course_name_unique,
ADD CONSTRAINT catalog_sections_catalog_course_name_unique
    UNIQUE (catalog_id, course_name);

CREATE INDEX IF NOT EXISTS idx_catalog_section_meetings_crn
ON public.catalog_section_meetings(section_id, crn);

CREATE INDEX IF NOT EXISTS idx_saved_schedule_sections_catalog_section_meeting_id
ON public.saved_schedule_sections(catalog_section_meeting_id);

UPDATE public.catalogs c
SET row_count = section_counts.row_count,
    updated_at = now()
FROM (
    SELECT catalog_id, count(*)::INTEGER AS row_count
    FROM public.catalog_sections
    GROUP BY catalog_id
) section_counts
WHERE c.id = section_counts.catalog_id;

UPDATE public.catalogs c
SET row_count = 0,
    status = CASE WHEN c.status = 'ready' THEN 'draft' ELSE c.status END,
    updated_at = now()
WHERE NOT EXISTS (
    SELECT 1
    FROM public.catalog_sections cs
    WHERE cs.catalog_id = c.id
);

COMMENT ON COLUMN public.catalog_sections.course_name IS
'User-defined course or requirement-group name shown in the requirement sidebar.';

COMMENT ON TABLE public.catalog_section_meetings IS
'Editable main-box rows for a saved catalog requirement, including CRN, instructor, and meeting time.';

COMMENT ON COLUMN public.catalog_section_meetings.crn IS
'Optional user-entered CRN or section identifier for this candidate row.';

COMMENT ON COLUMN public.catalog_section_meetings.instructor_name IS
'Optional instructor name for this candidate row.';

COMMENT ON COLUMN public.saved_schedule_sections.catalog_section_meeting_id IS
'Specific catalog_section_meetings row selected when the schedule was saved.';

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

            INSERT INTO public.catalog_section_meetings (
                section_id,
                crn,
                instructor_name,
                days,
                start_time,
                end_time,
                sort_order
            )
            VALUES (
                new_section_id,
                nullif(meeting_record ->> 'crn', ''),
                nullif(meeting_record ->> 'instructor_name', ''),
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
