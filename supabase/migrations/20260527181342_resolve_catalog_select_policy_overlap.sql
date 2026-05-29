BEGIN;

DROP POLICY IF EXISTS "users read own catalogs" ON catalogs;
DROP POLICY IF EXISTS "anyone can read demo catalogs" ON catalogs;
DROP POLICY IF EXISTS "authenticated read accessible catalogs" ON catalogs;
DROP POLICY IF EXISTS "anon read demo catalogs" ON catalogs;

CREATE POLICY "authenticated read accessible catalogs"
ON catalogs
FOR SELECT
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    OR source_type = 'demo'
);

CREATE POLICY "anon read demo catalogs"
ON catalogs
FOR SELECT
TO anon
USING (source_type = 'demo');

DROP POLICY IF EXISTS "users read own catalog_sections" ON catalog_sections;
DROP POLICY IF EXISTS "anyone can read demo catalog_sections" ON catalog_sections;
DROP POLICY IF EXISTS "authenticated read accessible catalog_sections" ON catalog_sections;
DROP POLICY IF EXISTS "anon read demo catalog_sections" ON catalog_sections;

CREATE POLICY "authenticated read accessible catalog_sections"
ON catalog_sections
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND (
              c.created_by = (SELECT auth.uid())
              OR c.source_type = 'demo'
          )
    )
);

CREATE POLICY "anon read demo catalog_sections"
ON catalog_sections
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.source_type = 'demo'
    )
);

DROP POLICY IF EXISTS "users read own catalog_section_meetings" ON catalog_section_meetings;
DROP POLICY IF EXISTS "anyone can read demo catalog_section_meetings" ON catalog_section_meetings;
DROP POLICY IF EXISTS "authenticated read accessible catalog_section_meetings" ON catalog_section_meetings;
DROP POLICY IF EXISTS "anon read demo catalog_section_meetings" ON catalog_section_meetings;

CREATE POLICY "authenticated read accessible catalog_section_meetings"
ON catalog_section_meetings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalog_sections cs
        JOIN catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND (
              c.created_by = (SELECT auth.uid())
              OR c.source_type = 'demo'
          )
    )
);

CREATE POLICY "anon read demo catalog_section_meetings"
ON catalog_section_meetings
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM catalog_sections cs
        JOIN catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.source_type = 'demo'
    )
);

COMMIT;
