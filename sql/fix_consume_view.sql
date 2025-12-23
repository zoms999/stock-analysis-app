-- Drop potential conflicting versions of the function
-- Use CASCADE to ensure triggers/policies depending on it are handled (use with caution, but for RPCs usually fine)
-- Actually, dropping function by signature is safer.
DROP FUNCTION IF EXISTS public.consume_view(uuid, int);
DROP FUNCTION IF EXISTS public.consume_view(uuid, int, uuid);

-- Re-create the function with the correct 3-parameter signature
CREATE OR REPLACE FUNCTION public.consume_view(p_user_id uuid, p_required_level int, p_post_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_daily_view_limit int;
    v_access_max_level int;
    v_current_view_count int;
    v_additional_view_count int;
    v_today date := CURRENT_DATE;
BEGIN
    -- 0. Check Deduplication (if post_id is provided)
    IF p_post_id IS NOT NULL THEN
        -- Check if post_view_logs table exists first (safeguard)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_view_logs') THEN
             IF EXISTS (
                SELECT 1 FROM public.post_view_logs 
                WHERE user_id = p_user_id 
                AND post_id = p_post_id 
                AND view_date = v_today
            ) THEN
                RETURN 'OK'; -- Already viewed today, don't consume limit
            END IF;
        END IF;
    END IF;

    -- 1. Get Plan Limits
    -- Ensure get_user_plan_limits exists
    SELECT daily_view_limit, access_max_level INTO v_daily_view_limit, v_access_max_level
    FROM public.get_user_plan_limits(p_user_id);

    -- 2. Check Level
    IF p_required_level > 0 AND v_access_max_level < p_required_level THEN
        RETURN 'LEVEL_LOW';
    END IF;

    -- 3. Get or Init Daily Usage (Atomic Upsert)
    INSERT INTO public.daily_usage (user_id, usage_date, view_count, write_count, additional_view_count, additional_write_count)
    VALUES (p_user_id, v_today, 0, 0, 0, 0)
    ON CONFLICT (user_id, usage_date) DO NOTHING;

    -- Lock row for update
    SELECT view_count, additional_view_count 
    INTO v_current_view_count, v_additional_view_count
    FROM public.daily_usage
    WHERE user_id = p_user_id AND usage_date = v_today
    FOR UPDATE;

    -- 4. Check Limit
    IF v_current_view_count >= (v_daily_view_limit + v_additional_view_count) THEN
        RETURN 'LIMIT_REACHED';
    END IF;

    -- 5. Increment Usage
    UPDATE public.daily_usage
    SET view_count = view_count + 1,
        updated_at = now()
    WHERE user_id = p_user_id AND usage_date = v_today;

    -- 6. Log View (for deduplication next time)
    IF p_post_id IS NOT NULL THEN
         IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_view_logs') THEN
            INSERT INTO public.post_view_logs (user_id, post_id, view_date)
            VALUES (p_user_id, p_post_id, v_today)
            ON CONFLICT (user_id, post_id, view_date) DO NOTHING;
         END IF;
    END IF;

    RETURN 'OK';
END;
$$;

-- Explicitly reload schema cache is not a standard SQL command, but creating/dropping functions usually triggers it.
