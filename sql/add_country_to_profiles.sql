-- Add country_code column to profiles table
-- Country codes use ISO 3166-1 alpha-2 format (e.g., "KR", "US", "JP")

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);

-- Add a comment to document the column
COMMENT ON COLUMN public.profiles.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., KR, US, JP)';

-- Optional: Add a check constraint to ensure valid format (2 uppercase letters)
ALTER TABLE public.profiles 
ADD CONSTRAINT country_code_format CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
