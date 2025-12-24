-- Fix Tournament Status Enum mismatch (Updated for Dependencies)
-- This script safely handles default value dependencies.

BEGIN;

-- 1. Remove the default value constraint first (dependency breaker)
ALTER TABLE public.tournaments ALTER COLUMN status DROP DEFAULT;

-- 2. Alter column to text to break type dependency
ALTER TABLE public.tournaments ALTER COLUMN status TYPE text;

-- 3. Drop the old enum type (now safe)
DROP TYPE IF EXISTS public.tournament_status;

-- 4. Create the standard enum type with Uppercase
CREATE TYPE public.tournament_status AS ENUM ('UPCOMING', 'OPEN', 'LOCKED', 'SETTLED');

-- 5. Update data to match Uppercase
UPDATE public.tournaments 
SET status = UPPER(status) 
WHERE status IS NOT NULL;

-- 6. Enforce new Type
ALTER TABLE public.tournaments 
ALTER COLUMN status TYPE public.tournament_status 
USING status::public.tournament_status;

-- 7. Restore the default value (using the new type)
ALTER TABLE public.tournaments ALTER COLUMN status SET DEFAULT 'UPCOMING'::public.tournament_status;

COMMIT;

-- Verify
SELECT enum_range(NULL::public.tournament_status);
