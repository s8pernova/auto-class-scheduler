-- Retire pre-MVP tables under ADR 0009
BEGIN;

DROP TABLE IF EXISTS public.possible_classes CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;

COMMIT;
