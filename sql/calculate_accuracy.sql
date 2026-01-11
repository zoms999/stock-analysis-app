-- 1. Add accuracy_score column to posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS accuracy_score numeric;

-- Index for sorting by accuracy
CREATE INDEX IF NOT EXISTS idx_posts_accuracy_score ON public.posts (accuracy_score DESC NULLS LAST);

-- 2. Function to Calculate Accuracy (Achievement Rate)
-- This function iterates through ACTIVE posts and updates their accuracy_score.
-- Logic: 
--   Achievement Rate = (실제 상승폭 ÷ 예측 상승폭) × 100
--   If prediction_type = 'LONG': (CurrentPrice - EntryPrice) / (TargetPrice - EntryPrice) * 100
--   If prediction_type = 'SHORT': (EntryPrice - CurrentPrice) / (EntryPrice - TargetPrice) * 100
--   Note: We use the *Latest* price available in market_prices for the post's ticker.

CREATE OR REPLACE FUNCTION public.calculate_and_update_accuracies()
RETURNS void AS $$
DECLARE
    r RECORD;
    latest_price numeric;
    calculated_accuracy numeric;
    predicted_move numeric;
    actual_move numeric;
BEGIN
    -- Loop through posts that have a prediction
    -- Target posts with prediction_status = 'WAITING'
    FOR r IN 
        SELECT id, ticker_symbol, entry_price, target_price, prediction_type 
        FROM public.posts 
        WHERE prediction_status = 'WAITING' 
          AND entry_price IS NOT NULL 
          AND entry_price > 0
          AND target_price IS NOT NULL
          AND target_price > 0
          AND prediction_type IS NOT NULL
    LOOP
        -- Get the specific latest price for this ticker from market_prices
        SELECT price INTO latest_price
        FROM public.market_prices
        WHERE ticker_symbol = r.ticker_symbol
          OR ticker_symbol = (SELECT symbol FROM public.assets WHERE api_id = r.ticker_symbol LIMIT 1) -- Try to map if needed
        ORDER BY recorded_at DESC
        LIMIT 1;

        -- If price exists, calculate achievement rate
        IF latest_price IS NOT NULL THEN
            IF r.prediction_type = 'LONG' THEN
                -- 예측 상승폭 = target_price - entry_price
                predicted_move := r.target_price - r.entry_price;
                -- 실제 상승폭 = current_price - entry_price
                actual_move := latest_price - r.entry_price;
                
                -- Avoid division by zero
                IF predicted_move > 0 THEN
                    -- If moved in opposite direction, set to 0
                    IF actual_move < 0 THEN
                        calculated_accuracy := 0;
                    ELSE
                        calculated_accuracy := (actual_move / predicted_move) * 100;
                    END IF;
                ELSE
                    calculated_accuracy := 0;
                END IF;
                
            ELSIF r.prediction_type = 'SHORT' THEN
                -- 예측 하락폭 = entry_price - target_price
                predicted_move := r.entry_price - r.target_price;
                -- 실제 하락폭 = entry_price - current_price
                actual_move := r.entry_price - latest_price;
                
                -- Avoid division by zero
                IF predicted_move > 0 THEN
                    -- If moved in opposite direction, set to 0
                    IF actual_move < 0 THEN
                        calculated_accuracy := 0;
                    ELSE
                        calculated_accuracy := (actual_move / predicted_move) * 100;
                    END IF;
                ELSE
                    calculated_accuracy := 0;
                END IF;
            END IF;

            -- Update the post
            UPDATE public.posts
            SET accuracy_score = ROUND(calculated_accuracy, 2)
            WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

