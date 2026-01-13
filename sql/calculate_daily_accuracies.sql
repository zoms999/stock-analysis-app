-- Calculate daily accuracies for all uncalculated predictions
-- This function should be run daily by the cron job

CREATE OR REPLACE FUNCTION public.calculate_daily_accuracies()
RETURNS TABLE(
    processed_count INTEGER,
    updated_posts INTEGER
) AS $$
DECLARE
    r RECORD;
    prev_close NUMERIC;
    actual_close NUMERIC;
    predicted_move NUMERIC;
    actual_move NUMERIC;
    accuracy NUMERIC;
    processed INTEGER := 0;
BEGIN
    -- Loop through all uncalculated predictions where date has passed
    FOR r IN 
        SELECT dp.id, dp.post_id, dp.prediction_date, dp.predicted_price,
               p.ticker_symbol
        FROM public.daily_predictions dp
        JOIN public.posts p ON dp.post_id = p.id
        WHERE dp.calculated_at IS NULL
          AND dp.prediction_date < CURRENT_DATE
        ORDER BY dp.prediction_date ASC
    LOOP
        -- Reset variables
        prev_close := NULL;
        actual_close := NULL;
        
        -- Get previous day's closing price
        -- Look for the last price recorded on the previous day
        SELECT price INTO prev_close
        FROM public.market_prices
        WHERE (ticker_symbol = r.ticker_symbol OR ticker_symbol = r.ticker_symbol || '-USD')
          AND DATE(recorded_at) = r.prediction_date - INTERVAL '1 day'
        ORDER BY recorded_at DESC
        LIMIT 1;
        
        -- If no exact previous day close, get the most recent price before prediction date
        IF prev_close IS NULL THEN
            SELECT price INTO prev_close
            FROM public.market_prices
            WHERE (ticker_symbol = r.ticker_symbol OR ticker_symbol = r.ticker_symbol || '-USD')
              AND DATE(recorded_at) < r.prediction_date
            ORDER BY recorded_at DESC
            LIMIT 1;
        END IF;
        
        -- Get actual closing price for prediction date
        -- Look for the last price recorded on the prediction date
        SELECT price INTO actual_close
        FROM public.market_prices
        WHERE (ticker_symbol = r.ticker_symbol OR ticker_symbol = r.ticker_symbol || '-USD')
          AND DATE(recorded_at) = r.prediction_date
        ORDER BY recorded_at DESC
        LIMIT 1;
        
        -- Calculate accuracy if both prices exist
        IF prev_close IS NOT NULL AND actual_close IS NOT NULL THEN
            predicted_move := r.predicted_price - prev_close;
            actual_move := actual_close - prev_close;
            
            IF predicted_move != 0 THEN
                -- Achievement rate = (actual move / predicted move) × 100
                accuracy := (actual_move / predicted_move) * 100;
                
                -- Cap at 0% and 100%
                IF accuracy < 0 THEN 
                    accuracy := 0; 
                END IF;
                IF accuracy > 100 THEN 
                    accuracy := 100; 
                END IF;
            ELSE
                -- If predicted move is 0, accuracy is 0
                accuracy := 0;
            END IF;
            
            -- Update the daily prediction
            UPDATE public.daily_predictions
            SET previous_close = prev_close,
                actual_close = actual_close,
                daily_accuracy = ROUND(accuracy, 2),
                calculated_at = NOW()
            WHERE id = r.id;
            
            processed := processed + 1;
        END IF;
    END LOOP;
    
    -- Update average accuracy for all posts that have daily predictions
    WITH post_averages AS (
        SELECT 
            post_id,
            ROUND(AVG(daily_accuracy), 2) as avg_accuracy
        FROM public.daily_predictions
        WHERE daily_accuracy IS NOT NULL
        GROUP BY post_id
    )
    UPDATE public.posts p
    SET average_daily_accuracy = pa.avg_accuracy
    FROM post_averages pa
    WHERE p.id = pa.post_id;
    
    -- Return statistics
    RETURN QUERY
    SELECT 
        processed,
        (SELECT COUNT(DISTINCT post_id)::INTEGER 
         FROM public.daily_predictions 
         WHERE calculated_at IS NOT NULL)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_daily_accuracies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_accuracies() TO anon;
