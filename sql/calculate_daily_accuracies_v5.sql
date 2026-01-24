CREATE OR REPLACE FUNCTION public.calculate_daily_accuracies_v5()
RETURNS table (
    processed_count int,
    updated_posts int
) AS $$
DECLARE
    r RECORD;
    prev_close_record RECORD;
    actual_close_record RECORD;
    calculated_accuracy numeric;
    predicted_move numeric;
    actual_move numeric;
    processed_cnt int := 0;
    updated_cnt int := 0;
    
    -- Variables for debugging/logging (optional)
    v_prev_close numeric;
    v_actual_close numeric;
BEGIN
    -- Loop through daily_predictions that need calculation
    FOR r IN 
        SELECT dp.id, dp.post_id, dp.prediction_date, dp.predicted_price, dp.previous_close, p.ticker_symbol
        FROM public.daily_predictions dp
        JOIN public.posts p ON dp.post_id = p.id
        -- Remove strict date filter to allow fixing future dates if they were wrongly populated
        -- WHERE dp.prediction_date <= CURRENT_DATE 
    LOOP
        processed_cnt := processed_cnt + 1;
        
        -- ✅ Safety Check: If prediction_date is in the future, we should NOT have actual values.
        -- We also reset previous_close if it was wrongly set to current price.
        IF r.prediction_date > CURRENT_DATE THEN
             UPDATE public.daily_predictions
             SET previous_close = NULL, actual_close = NULL, daily_accuracy = NULL, calculated_at = NULL
             WHERE id = r.id AND (previous_close IS NOT NULL OR actual_close IS NOT NULL);
             
             CONTINUE; -- Skip processing for future dates
        END IF;

        -- 1. Get Previous Close (Strictly BEFORE prediction_date, but within reasonable range)
        -- Added check: recorded_at > prediction_date - 10 days (to avoid mapping very old price to new date)
        SELECT price, recorded_at INTO prev_close_record
        FROM public.market_prices
        WHERE ticker_symbol = r.ticker_symbol
          AND recorded_at < (r.prediction_date || ' 00:00:00')::timestamp
          AND recorded_at > ((r.prediction_date)::date - INTERVAL '10 days') -- ✅ Prevent stale data mapping
        ORDER BY recorded_at DESC
        LIMIT 1;
        
        -- If direct match failed, try with -USD or other variants
        IF prev_close_record IS NULL THEN
             SELECT price, recorded_at INTO prev_close_record
             FROM public.market_prices
             WHERE (ticker_symbol = r.ticker_symbol || '-USD' 
                    OR ticker_symbol = (SELECT symbol FROM public.assets WHERE api_id = r.ticker_symbol LIMIT 1))
               AND recorded_at < (r.prediction_date || ' 00:00:00')::timestamp
               AND recorded_at > ((r.prediction_date)::date - INTERVAL '10 days') -- ✅ Prevent stale data mapping
             ORDER BY recorded_at DESC
             LIMIT 1;
        END IF;

        -- 2. Get Actual Close (On prediction_date)
        SELECT price, recorded_at INTO actual_close_record
        FROM public.market_prices
        WHERE ticker_symbol = r.ticker_symbol
          AND recorded_at >= (r.prediction_date || ' 00:00:00')::timestamp
          AND recorded_at < ((r.prediction_date)::date + 1)::timestamp
        ORDER BY recorded_at DESC
        LIMIT 1;

        -- Retry for crypto variant
        IF actual_close_record IS NULL THEN
            SELECT price, recorded_at INTO actual_close_record
            FROM public.market_prices
            WHERE (ticker_symbol = r.ticker_symbol || '-USD'
                   OR ticker_symbol = (SELECT symbol FROM public.assets WHERE api_id = r.ticker_symbol LIMIT 1))
              AND recorded_at >= (r.prediction_date || ' 00:00:00')::timestamp
              AND recorded_at < ((r.prediction_date)::date + 1)::timestamp
            ORDER BY recorded_at DESC
            LIMIT 1;
        END IF;
        
        v_prev_close := prev_close_record.price;
        v_actual_close := actual_close_record.price;
        
        -- Only override manually set previous_close if fetch succeeded
        IF v_prev_close IS NULL AND r.previous_close IS NOT NULL THEN
            v_prev_close := r.previous_close;
        END IF;

        IF v_prev_close IS NOT NULL AND v_actual_close IS NOT NULL THEN
            
            -- Calculate Raw Accuracy
            predicted_move := r.predicted_price - v_prev_close;
            actual_move := v_actual_close - v_prev_close;
            
            IF predicted_move != 0 THEN
                calculated_accuracy := (actual_move / predicted_move) * 100;
                
                UPDATE public.daily_predictions
                SET 
                    previous_close = v_prev_close,
                    actual_close = v_actual_close,
                    daily_accuracy = calculated_accuracy,
                    calculated_at = NOW()
                WHERE id = r.id;
                
                updated_cnt := updated_cnt + 1;
            ELSE
                 UPDATE public.daily_predictions
                SET 
                    previous_close = v_prev_close,
                    actual_close = v_actual_close,
                    daily_accuracy = NULL,
                    calculated_at = NOW()
                WHERE id = r.id;
            END IF;
            
        ELSIF v_prev_close IS NOT NULL THEN
            -- Update previous_close even if actual_close is not yet available
            UPDATE public.daily_predictions
            SET previous_close = v_prev_close
            WHERE id = r.id; 
        END IF;
        
    END LOOP;
    
    RETURN QUERY SELECT processed_cnt, updated_cnt;
END;
$$ LANGUAGE plpgsql;
