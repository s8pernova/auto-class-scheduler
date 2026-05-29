BEGIN;

-- Fix user-owned table grants
-- favorites is user-owned. Anonymous users should have no table or
-- sequence permissions here.

REVOKE ALL PRIVILEGES ON TABLE public.favorites FROM anon;
REVOKE ALL PRIVILEGES ON SEQUENCE public.favorites_id_seq FROM anon;

-- Signed-in users may use favorites directly through Supabase client.
-- RLS still limits rows to auth.uid() = user_id.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.favorites TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.favorites_id_seq TO authenticated;

-- Fix renamed saved schedule tables
-- These are user-owned saved results. Anonymous users should have no
-- access. Keep authenticated grants because the frontend may read/write
-- the user's saved schedules directly through Supabase client.

REVOKE ALL PRIVILEGES ON TABLE public.saved_schedules FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.saved_schedule_sections FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_schedule_sections TO authenticated;

-- Add sequence grants only if these tables use identity/bigserial ids.
-- Harmless if the sequences exist, skipped if they do not.
DO $$
BEGIN
    IF to_regclass('public.saved_schedules_id_seq') IS NOT NULL THEN
        REVOKE ALL PRIVILEGES ON SEQUENCE public.saved_schedules_id_seq FROM anon;
        GRANT USAGE, SELECT ON SEQUENCE public.saved_schedules_id_seq TO authenticated;
    END IF;

    IF to_regclass('public.saved_schedule_sections_id_seq') IS NOT NULL THEN
        REVOKE ALL PRIVILEGES ON SEQUENCE public.saved_schedule_sections_id_seq FROM anon;
        GRANT USAGE, SELECT ON SEQUENCE public.saved_schedule_sections_id_seq TO authenticated;
    END IF;
END $$;

-- Keep intentional public catalog reads
-- These are catalog/reference tables. Keeping anon SELECT is reasonable
-- if the app lets unsigned users browse demo/public course data.

GRANT SELECT ON TABLE public.possible_classes TO anon, authenticated;
GRANT SELECT ON TABLE public.schools TO anon, authenticated;

-- catalogs depends on your current product rule:
-- anon can read demo catalogs only through RLS;
-- authenticated users can read their own catalogs and demos through RLS.
GRANT SELECT ON TABLE public.catalogs TO anon, authenticated;

-- Future default safety
-- New tables should not become reachable through the Data API by accident.
-- Each future migration should grant only the exact privileges needed.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, public;

COMMIT;