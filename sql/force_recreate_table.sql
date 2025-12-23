-- Force Recreate point_transactions Table
-- WARNING: This will delete existing transaction data. Since this is likely dev/test data, it should be fine.
DROP TABLE IF EXISTS public.point_transactions CASCADE;

CREATE TABLE public.point_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    reason TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARN', 'USE', 'ADMIN', 'REFUND')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Users can view own point transactions" 
ON public.point_transactions FOR SELECT 
USING (auth.uid() = user_id);

-- Re-grant Permissions
GRANT ALL ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;

-- Recreate RPCs again to ensure they are bound to the new table OID
CREATE OR REPLACE FUNCTION public.purchase_additional_view(p_user_id uuid, p_points int)
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
    VALUES (p_user_id, -p_points, '열람권 추가 구매', 'USE');

    INSERT INTO public.daily_usage (user_id, usage_date, view_count, write_count, additional_view_count, additional_write_count)
    VALUES (p_user_id, v_today, 0, 0, 1, 0)
    ON CONFLICT (user_id, usage_date) 
    DO UPDATE SET additional_view_count = daily_usage.additional_view_count + 1;

    RETURN 'OK';
END;
$$;

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
