-- Test query to check if country_code column exists and has data
-- Run this in Supabase SQL Editor to verify

-- 1. Check if column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'country_code';

-- 2. Check current data (sample of first 10 profiles)
SELECT id, email, nickname, country_code
FROM profiles
LIMIT 10;

-- 3. Count profiles with country codes
SELECT 
  COUNT(*) as total_profiles,
  COUNT(country_code) as profiles_with_country,
  COUNT(*) - COUNT(country_code) as profiles_without_country
FROM profiles;

-- 4. If you want to add test data, run this:
-- UPDATE profiles 
-- SET country_code = 'KR' 
-- WHERE id = (SELECT id FROM profiles LIMIT 1);
