BEGIN;

ALTER TABLE catalog_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_sections FORCE ROW LEVEL SECURITY;

ALTER TABLE catalog_section_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_section_meetings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own catalog_sections" ON catalog_sections;
DROP POLICY IF EXISTS "users insert own catalog_sections" ON catalog_sections;
DROP POLICY IF EXISTS "users update own catalog_sections" ON catalog_sections;
DROP POLICY IF EXISTS "users delete own catalog_sections" ON catalog_sections;
DROP POLICY IF EXISTS "anyone can read demo catalog_sections" ON catalog_sections;

DROP POLICY IF EXISTS "users read own catalog_section_meetings" ON catalog_section_meetings;
DROP POLICY IF EXISTS "users insert own catalog_section_meetings" ON catalog_section_meetings;
DROP POLICY IF EXISTS "users update own catalog_section_meetings" ON catalog_section_meetings;
DROP POLICY IF EXISTS "users delete own catalog_section_meetings" ON catalog_section_meetings;
DROP POLICY IF EXISTS "anyone can read demo catalog_section_meetings" ON catalog_section_meetings;

CREATE POLICY "users read own catalog_sections"
ON catalog_sections
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
    )
);

CREATE POLICY "users insert own catalog_sections"
ON catalog_sections
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
    )
);

CREATE POLICY "users update own catalog_sections"
ON catalog_sections
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
    )
);

CREATE POLICY "users delete own catalog_sections"
ON catalog_sections
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
    )
);

CREATE POLICY "anyone can read demo catalog_sections"
ON catalog_sections
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalogs c
        WHERE c.id = catalog_sections.catalog_id
          AND c.source_type = 'demo'
    )
);

CREATE POLICY "users read own catalog_section_meetings"
ON catalog_section_meetings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalog_sections cs
        JOIN catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
    )
);

CREATE POLICY "users insert own catalog_section_meetings"
ON catalog_section_meetings
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM catalog_sections cs
        JOIN catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
    )
);

CREATE POLICY "users update own catalog_section_meetings"
ON catalog_section_meetings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalog_sections cs
        JOIN catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM catalog_sections cs
        JOIN catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
    )
);

CREATE POLICY "users delete own catalog_section_meetings"
ON catalog_section_meetings
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalog_sections cs
        JOIN catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.created_by = (SELECT auth.uid())
          AND c.source_type <> 'demo'
    )
);

CREATE POLICY "anyone can read demo catalog_section_meetings"
ON catalog_section_meetings
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM catalog_sections cs
        JOIN catalogs c ON c.id = cs.catalog_id
        WHERE cs.id = catalog_section_meetings.section_id
          AND c.source_type = 'demo'
    )
);

REVOKE ALL PRIVILEGES ON TABLE catalog_sections FROM anon;
REVOKE ALL PRIVILEGES ON TABLE catalog_section_meetings FROM anon;

GRANT SELECT ON TABLE catalog_sections TO anon;
GRANT SELECT ON TABLE catalog_section_meetings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE catalog_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE catalog_section_meetings TO authenticated;

COMMIT;
