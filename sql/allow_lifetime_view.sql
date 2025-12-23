-- 1. Update consume_view to allow LIFETIME access (ignore usage_date in deduplication)
CREATE OR REPLACE FUNCTION public.consume_view(p_user_id uuid, p_required_level int, p_post_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_daily_view_limit int;
    v_access_max_level int;
    v_current_view_count int;
    v_additional_view_count int;
    v_today date := CURRENT_DATE;
BEGIN
    -- 0. Optimistic Deduplication Check (No Lock) - REMOVED usage_date check
    IF p_post_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.post_view_logs 
            WHERE user_id = p_user_id 
            AND post_id = p_post_id 
            -- AND view_date = v_today  <-- REMOVED to allow lifetime access
        ) THEN
            RETURN 'OK'; -- Already viewed (ever)
        END IF;
    END IF;

    -- 1. Get Plan Limits
    SELECT daily_view_limit, access_max_level INTO v_daily_view_limit, v_access_max_level
    FROM public.get_user_plan_limits(p_user_id);

    -- 2. Check Level
    IF p_required_level > 0 AND v_access_max_level < p_required_level THEN
        RETURN 'LEVEL_LOW';
    END IF;

    -- 3. Get or Init Daily Usage (Atomic Upsert) and LOCK
    INSERT INTO public.daily_usage (user_id, usage_date, view_count, write_count, additional_view_count, additional_write_count)
    VALUES (p_user_id, v_today, 0, 0, 0, 0)
    ON CONFLICT (user_id, usage_date) DO NOTHING;

    -- Lock row for update
    SELECT view_count, additional_view_count 
    INTO v_current_view_count, v_additional_view_count
    FROM public.daily_usage
    WHERE user_id = p_user_id AND usage_date = v_today
    FOR UPDATE;

    -- 3.5. Double-Check Deduplication (After Lock) - REMOVED usage_date check
    IF p_post_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.post_view_logs 
            WHERE user_id = p_user_id 
            AND post_id = p_post_id 
            -- AND view_date = v_today <-- REMOVED
        ) THEN
            RETURN 'OK';
        END IF;
    END IF;

    -- 4. Check Limit
    IF v_current_view_count >= (v_daily_view_limit + v_additional_view_count) THEN
        RETURN 'LIMIT_REACHED';
    END IF;

    -- 5. Increment Usage
    UPDATE public.daily_usage
    SET view_count = view_count + 1,
        updated_at = now()
    WHERE user_id = p_user_id AND usage_date = v_today;

    -- 6. Log View
    IF p_post_id IS NOT NULL THEN
        INSERT INTO public.post_view_logs (user_id, post_id, view_date)
        VALUES (p_user_id, p_post_id, v_today)
        ON CONFLICT (user_id, post_id, view_date) DO NOTHING;
    END IF;

    RETURN 'OK';
END;
$$;

-- 2. RPC to check if user has viewed the post (for client-side check)
CREATE OR REPLACE FUNCTION public.has_viewed_post(p_user_id uuid, p_post_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.post_view_logs
        WHERE user_id = p_user_id
        AND post_id = p_post_id
    );
END;
$$;

-- Grant permissions for new RPC
GRANT EXECUTE ON FUNCTION public.has_viewed_post(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_viewed_post(uuid, uuid) TO service_role;
