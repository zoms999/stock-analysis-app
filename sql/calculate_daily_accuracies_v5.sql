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
    -- We target predictions where actual_close is NULL (needs fetch) OR daily_accuracy is NULL
    -- Also we can force re-calculation if needed, but for now standard logic:
    -- We assume "need calculation" if the date has passed (or is today) and we haven't finalized it.
    -- Ideally, we check all 'WAITING' or generally all predictions <= TODAY.
    
    FOR r IN 
        SELECT dp.id, dp.post_id, dp.prediction_date, dp.predicted_price, dp.previous_close, p.ticker_symbol
        FROM public.daily_predictions dp
        JOIN public.posts p ON dp.post_id = p.id
        WHERE dp.prediction_date <= CURRENT_DATE
          -- Re-calculate if accuracy is NULL or we want to update actual_close
          -- You might want to remove 'actual_close IS NOT NULL' check if you want to allow re-fetching prices
    LOOP
        processed_cnt := processed_cnt + 1;
        
        -- 1. Get Previous Close (Strictly BEFORE prediction_date)
        SELECT price, recorded_at INTO prev_close_record
        FROM public.market_prices
        WHERE ticker_symbol = r.ticker_symbol
          AND recorded_at < (r.prediction_date || ' 00:00:00')::timestamp
        ORDER BY recorded_at DESC
        LIMIT 1;
        
        -- If direct match failed, try with -USD or other variants (logic from v4)
        IF prev_close_record IS NULL THEN
             SELECT price, recorded_at INTO prev_close_record
             FROM public.market_prices
             WHERE (ticker_symbol = r.ticker_symbol || '-USD' 
                    OR ticker_symbol = (SELECT symbol FROM public.assets WHERE api_id = r.ticker_symbol LIMIT 1))
               AND recorded_at < (r.prediction_date || ' 00:00:00')::timestamp
             ORDER BY recorded_at DESC
             LIMIT 1;
        END IF;

        -- 2. Get Actual Close (On prediction_date or latest available on that day)
        -- Ideally we want the close of that specific day. 
        -- If recorded_at is timestamp, we look for data on that day.
        SELECT price, recorded_at INTO actual_close_record
        FROM public.market_prices
        WHERE ticker_symbol = r.ticker_symbol
          AND recorded_at >= (r.prediction_date || ' 00:00:00')::timestamp
          AND recorded_at < ((r.prediction_date)::date + 1)::timestamp
        ORDER BY recorded_at DESC -- Latest on that day is usually the "close" if we have intraday
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
        
        -- Note: If previous_close is manually set in daily_predictions (r.previous_close), 
        -- we *could* prefer it, but user requested strict definition. 
        -- Let's use the fetched one to be safe and consistent, 
        -- OR failover to r.previous_close if fetch failed.
        IF v_prev_close IS NULL AND r.previous_close IS NOT NULL THEN
            v_prev_close := r.previous_close;
        END IF;

        IF v_prev_close IS NOT NULL AND v_actual_close IS NOT NULL THEN
            
            -- Calculate Raw Accuracy
            -- Formula: ((Actual - Prev) / (Predicted - Prev)) * 100
            
            predicted_move := r.predicted_price - v_prev_close;
            actual_move := v_actual_close - v_prev_close;
            
            IF predicted_move != 0 THEN
                calculated_accuracy := (actual_move / predicted_move) * 100;
                -- No rounding here? Or round to 2 decimals? User said "raw display", usually table formats it.
                -- Let's store round(x, 2) or high precision? DB column is numeric.
                -- Storing slightly rounded (2 decimal) is usually safer for UI.
                -- User example -120.1% suggests 1 decimal place.
                -- Let's round to 4 internally, display logic handles presentation.
                
                -- UPDATE with calculated values
                UPDATE public.daily_predictions
                SET 
                    previous_close = v_prev_close,
                    actual_close = v_actual_close,
                    daily_accuracy = calculated_accuracy,
                    calculated_at = NOW()
                WHERE id = r.id;
                
                updated_cnt := updated_cnt + 1;
            ELSE
                -- Division by zero -> NULL (Calculation Impossible)
                 UPDATE public.daily_predictions
                SET 
                    previous_close = v_prev_close,
                    actual_close = v_actual_close,
                    daily_accuracy = NULL, -- Explicit NULL
                    calculated_at = NOW()
                WHERE id = r.id;
            END IF;
            
        ELSIF v_prev_close IS NOT NULL AND v_actual_close IS NULL THEN
            -- We have prev close but no actual close yet (maybe market hasn't closed or no data)
            -- Just update prev_close if needed
            UPDATE public.daily_predictions
            SET previous_close = v_prev_close
            WHERE id = r.id AND previous_close IS NULL;
        END IF;
        
    END LOOP;
    
    RETURN QUERY SELECT processed_cnt, updated_cnt;
END;
$$ LANGUAGE plpgsql;
