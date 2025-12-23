-- Drop existing functions to ensure clean slate
DROP FUNCTION IF EXISTS public.purchase_additional_view(uuid, int);
DROP FUNCTION IF EXISTS public.purchase_additional_write(uuid, int);

-- Recreate purchase_additional_view
CREATE OR REPLACE FUNCTION public.purchase_additional_view(p_user_id uuid, p_points int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_balance int;
    v_today date := CURRENT_DATE;
BEGIN
    -- Check Balance
    SELECT point_balance INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_points THEN
        RETURN 'FAIL_INSUFFICIENT_POINTS';
    END IF;

    -- Deduct
    UPDATE public.profiles
    SET point_balance = point_balance - p_points,
        updated_at = now()
    WHERE id = p_user_id;

    -- Add Transaction (Ensure table exists first! Users ran fix_purchase_failure.sql hopefully)
    INSERT INTO public.point_transactions (user_id, amount, reason, type)
    VALUES (p_user_id, -p_points, '열람권 추가 구매', 'USE');

    -- Grant Permission
    INSERT INTO public.daily_usage (user_id, usage_date, view_count, write_count, additional_view_count, additional_write_count)
    VALUES (p_user_id, v_today, 0, 0, 1, 0)
    ON CONFLICT (user_id, usage_date) 
    DO UPDATE SET additional_view_count = daily_usage.additional_view_count + 1;

    RETURN 'OK';
END;
$$;

-- Recreate purchase_additional_write
CREATE OR REPLACE FUNCTION public.purchase_additional_write(p_user_id uuid, p_points int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_balance int;
    v_today date := CURRENT_DATE;
BEGIN
    SELECT point_balance INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_points THEN
        RETURN 'FAIL_INSUFFICIENT_POINTS';
    END IF;

    UPDATE public.profiles
    SET point_balance = point_balance - p_points,
        updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO public.point_transactions (user_id, amount, reason, type)
    VALUES (p_user_id, -p_points, '글쓰기권 추가 구매', 'USE');

    INSERT INTO public.daily_usage (user_id, usage_date, view_count, write_count, additional_view_count, additional_write_count)
    VALUES (p_user_id, v_today, 0, 0, 0, 1)
    ON CONFLICT (user_id, usage_date) 
    DO UPDATE SET additional_write_count = daily_usage.additional_write_count + 1;

    RETURN 'OK';
END;
$$;

-- Explicitly Grant Execute Permissions
-- Authenticated users need to call this
GRANT EXECUTE ON FUNCTION public.purchase_additional_view(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_additional_view(uuid, int) TO service_role;

GRANT EXECUTE ON FUNCTION public.purchase_additional_write(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_additional_write(uuid, int) TO service_role;
