BEGIN;

ALTER TABLE public.saved_schedule_sections
DROP CONSTRAINT IF EXISTS saved_schedule_sections_pkey;

ALTER TABLE public.saved_schedule_sections
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS course_name TEXT,
ADD COLUMN IF NOT EXISTS crn TEXT,
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE public.saved_schedule_sections
SET course_name = COALESCE(
    NULLIF(btrim(course_name), ''),
    NULLIF(btrim(concat_ws(' ', subject_code, course_number::TEXT)), ''),
    NULLIF(btrim(course_title), ''),
    'Legacy course'
)
WHERE course_name IS NULL
   OR btrim(course_name) = '';

ALTER TABLE public.saved_schedule_sections
ALTER COLUMN id SET NOT NULL,
ALTER COLUMN course_name SET NOT NULL,
ALTER COLUMN subject_code DROP NOT NULL,
ALTER COLUMN course_number DROP NOT NULL,
ALTER COLUMN section_code DROP NOT NULL,
ALTER COLUMN credits SET DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.saved_schedule_sections'::regclass
          AND contype = 'p'
    ) THEN
        ALTER TABLE public.saved_schedule_sections
        ADD CONSTRAINT saved_schedule_sections_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS saved_schedule_sections_schedule_catalog_section_idx
ON public.saved_schedule_sections(schedule_id, catalog_section_id)
WHERE catalog_section_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_schedule_sections_schedule_sort
ON public.saved_schedule_sections(schedule_id, sort_order);

COMMENT ON COLUMN public.saved_schedule_sections.course_name IS
'Catalog course or requirement bucket name captured when the schedule is saved.';

COMMENT ON COLUMN public.saved_schedule_sections.crn IS
'Optional user-entered CRN or section identifier captured from catalog_sections.';

COMMIT;
