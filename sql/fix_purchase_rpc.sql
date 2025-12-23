-- Purchase Additional View (Points) - CORRECTED
CREATE OR REPLACE FUNCTION public.purchase_additional_view(p_user_id uuid, p_points int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_balance int;
    v_today date := CURRENT_DATE;
BEGIN
    -- 1. Check Point Balance from profiles table
    SELECT point_balance INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE; -- Lock the profile row to prevent race conditions

    IF v_current_balance IS NULL OR v_current_balance < p_points THEN
        RETURN 'FAIL_INSUFFICIENT_POINTS';
    END IF;

    -- 2. Deduct Points
    UPDATE public.profiles
    SET point_balance = point_balance - p_points,
        updated_at = now()
    WHERE id = p_user_id;

    -- 3. Log Transaction
    INSERT INTO public.point_transactions (user_id, amount, reason, type)
    VALUES (p_user_id, -p_points, '열람권 추가 구매', 'USE');

    -- 4. Update Usage (Grant Access)
    INSERT INTO public.daily_usage (user_id, usage_date, view_count, write_count, additional_view_count, additional_write_count)
    VALUES (p_user_id, v_today, 0, 0, 1, 0) -- Start with 1 additional if new row
    ON CONFLICT (user_id, usage_date) 
    DO UPDATE SET additional_view_count = daily_usage.additional_view_count + 1;

    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    -- Log error if needed, but for now just return FAIL
    RETURN 'FAIL_ERROR';
END;
$$;

-- Purchase Additional Write (Points) - CORRECTED
CREATE OR REPLACE FUNCTION public.purchase_additional_write(p_user_id uuid, p_points int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_balance int;
    v_today date := CURRENT_DATE;
BEGIN
    -- 1. Check Point Balance
    SELECT point_balance INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_points THEN
        RETURN 'FAIL_INSUFFICIENT_POINTS';
    END IF;

    -- 2. Deduct Points
    UPDATE public.profiles
    SET point_balance = point_balance - p_points,
        updated_at = now()
    WHERE id = p_user_id;

    -- 3. Log Transaction
    INSERT INTO public.point_transactions (user_id, amount, reason, type)
    VALUES (p_user_id, -p_points, '글쓰기권 추가 구매', 'USE');

    -- 4. Update Usage
    INSERT INTO public.daily_usage (user_id, usage_date, view_count, write_count, additional_view_count, additional_write_count)
    VALUES (p_user_id, v_today, 0, 0, 0, 1)
    ON CONFLICT (user_id, usage_date) 
    DO UPDATE SET additional_write_count = daily_usage.additional_write_count + 1;

    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    RETURN 'FAIL_ERROR';
END;
$$;
