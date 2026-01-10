-- Drop the function first to release dependency on the type
DROP FUNCTION IF EXISTS public.user_stats(public.profiles);

-- Drop the type if it exists to ensure clean state
DROP TYPE IF EXISTS public.user_stats_result CASCADE;

-- Create a type for the stats return value
CREATE TYPE public.user_stats_result AS (
  recent_accuracy numeric,
  all_time_accuracy numeric,
  total_count bigint
);

-- Create the function to compute stats for a user
-- This function follows PostgREST computed field conventions (takes a record of the table)
CREATE OR REPLACE FUNCTION public.user_stats(profile_row public.profiles)
RETURNS public.user_stats_result
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result public.user_stats_result;
BEGIN
  -- Calculate Total Count
  SELECT COUNT(*)
  INTO result.total_count
  FROM public.posts
  WHERE user_id = profile_row.id;

  -- Calculate All-Time Accuracy (average of accuracy_score where it is not null)
  SELECT COALESCE(AVG(accuracy_score), 0)
  INTO result.all_time_accuracy
  FROM public.posts
  WHERE user_id = profile_row.id
    AND accuracy_score IS NOT NULL;

  -- Calculate Recent Accuracy (last 5 days)
  SELECT COALESCE(AVG(accuracy_score), 0)
  INTO result.recent_accuracy
  FROM public.posts
  WHERE user_id = profile_row.id
    AND accuracy_score IS NOT NULL
    AND created_at >= (NOW() - INTERVAL '5 days');

  RETURN result;
END;
$$;

-- Grant permissions to ensure API can access it
GRANT EXECUTE ON FUNCTION public.user_stats(public.profiles) TO postgres, anon, authenticated, service_role;
