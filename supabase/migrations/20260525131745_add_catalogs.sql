BEGIN;

CREATE TABLE IF NOT EXISTS catalogs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name                    TEXT        NOT NULL,
    description             TEXT,

    source_type             TEXT        NOT NULL DEFAULT 'manual'
                            CHECK (source_type IN (
                                'csv',
                                'paste',
                                'manual',
                                'importer',
                                'demo'
                            )),

    school_name             TEXT,
    term_name               TEXT,

    status                  TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN (
                                'draft',
                                'ready',
                                'error',
                                'archived'
                            )),

    row_count               INTEGER     NOT NULL DEFAULT 0
                            CHECK (row_count >= 0),

    source_metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,

    created_by              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_imported_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_catalogs_created_by
ON catalogs(created_by);

CREATE INDEX IF NOT EXISTS idx_catalogs_status
ON catalogs(status);

CREATE INDEX IF NOT EXISTS idx_catalogs_source_type
ON catalogs(source_type);

ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own catalogs" ON catalogs;
DROP POLICY IF EXISTS "users insert own catalogs" ON catalogs;
DROP POLICY IF EXISTS "users update own catalogs" ON catalogs;
DROP POLICY IF EXISTS "users delete own catalogs" ON catalogs;
DROP POLICY IF EXISTS "anyone can read demo catalogs" ON catalogs;

CREATE POLICY "users read own catalogs"
ON catalogs
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = created_by);

CREATE POLICY "users insert own catalogs"
ON catalogs
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND source_type <> 'demo'
);

CREATE POLICY "users update own catalogs"
ON catalogs
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = created_by)
WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND source_type <> 'demo'
);

CREATE POLICY "users delete own catalogs"
ON catalogs
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = created_by);

CREATE POLICY "anyone can read demo catalogs"
ON catalogs
FOR SELECT
TO anon, authenticated
USING (source_type = 'demo');

GRANT SELECT, INSERT, UPDATE, DELETE ON catalogs TO authenticated;
GRANT SELECT ON catalogs TO anon;

COMMIT;