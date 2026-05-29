-- Implement ADR 0008: use user-defined course names for BYOC grouping.

BEGIN;

ALTER TABLE public.catalog_sections
ADD COLUMN IF NOT EXISTS course_name TEXT;

UPDATE public.catalog_sections
SET course_name = btrim(concat_ws(' ', subject_code, course_number::TEXT))
WHERE course_name IS NULL
   OR btrim(course_name) = '';

ALTER TABLE public.catalog_sections
ALTER COLUMN course_name SET NOT NULL;

ALTER TABLE public.catalog_sections
DROP CONSTRAINT IF EXISTS catalog_sections_course_name_length,
ADD CONSTRAINT catalog_sections_course_name_length
    CHECK (char_length(btrim(course_name)) BETWEEN 1 AND 200);

ALTER TABLE public.catalog_section_meetings
DROP CONSTRAINT IF EXISTS catalog_section_meetings_days_format,
ADD CONSTRAINT catalog_section_meetings_days_format
    CHECK (days ~ '^[MTWRFS]+$');

DROP INDEX IF EXISTS public.idx_catalog_sections_course;

CREATE INDEX IF NOT EXISTS idx_catalog_sections_course_name
ON public.catalog_sections(catalog_id, course_name);

COMMENT ON COLUMN public.catalog_sections.course_name IS
'User-defined course or requirement-group name used to group candidate sections during generation.';

COMMENT ON COLUMN public.catalog_section_meetings.days IS
'Compact meeting day codes. Use M, T, W, R, F, and S; use R for Thursday.';

ALTER TABLE public.catalog_sections
DROP COLUMN IF EXISTS subject_code,
DROP COLUMN IF EXISTS course_number,
DROP COLUMN IF EXISTS section_code;

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
