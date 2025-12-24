-- Fix Tournament Enum Type mismatch
-- This script normalizes the tournament_type enum to use Uppercase 'DECIMAL' and 'PREDICTION'.

-- 1. Create a potential temporary type to migrate data if needed (optional safety step, but here we just force it)
-- Since we are in development, we can try to alter it directly.

BEGIN;

-- 2. Drop the existing constraint if it exists (for check constraints) or alter column type
ALTER TABLE public.tournaments ALTER COLUMN event_type TYPE text;

-- 3. Drop the old enum type if it exists to clear any 'prediction' vs 'Prediction' confusion
DROP TYPE IF EXISTS public.tournament_type;

-- 4. Create the standard enum type
CREATE TYPE public.tournament_type AS ENUM ('DECIMAL', 'PREDICTION');

-- 5. Update existing data to match the new enum (handle various cases)
UPDATE public.tournaments 
SET event_type = UPPER(event_type) 
WHERE event_type IS NOT NULL;

-- 6. Enforce new Type
ALTER TABLE public.tournaments 
ALTER COLUMN event_type TYPE public.tournament_type 
USING event_type::public.tournament_type;

COMMIT;

-- Verify
SELECT enum_range(NULL::public.tournament_type);
