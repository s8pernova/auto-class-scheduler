BEGIN;

-- Full catalog-section replacement needs to delete old rows, insert sections,
-- insert meetings, and update catalog metadata as one database transaction.
-- The JSONB argument is an RPC input envelope only; canonical storage remains
-- the normalized catalog_sections and catalog_section_meetings tables.
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

        IF jsonb_typeof(section_record -> 'meetings') <> 'array'
           OR jsonb_array_length(section_record -> 'meetings') = 0 THEN
            RAISE EXCEPTION 'Each catalog section must include at least one meeting'
                USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.catalog_sections (
            catalog_id,
            subject_code,
            course_number,
            section_code,
            crn,
            instructor_name,
            sort_order,
            source_metadata
        )
        VALUES (
            p_catalog_id,
            upper(trim(section_record ->> 'subject_code')),
            (section_record ->> 'course_number')::INTEGER,
            nullif(section_record ->> 'section_code', ''),
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
