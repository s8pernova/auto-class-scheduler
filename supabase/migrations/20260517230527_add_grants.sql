-- Grant PostgREST API access to public tables.

BEGIN;

-- Schedules: read-only
GRANT SELECT ON schedules TO anon, authenticated;

-- Schedule sections: read-only
GRANT SELECT ON schedule_sections TO anon, authenticated;

-- Possible classes: read-only
GRANT SELECT ON possible_classes TO anon, authenticated;

-- Favorites: full CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON favorites TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE favorites_id_seq TO anon, authenticated;

COMMIT;
