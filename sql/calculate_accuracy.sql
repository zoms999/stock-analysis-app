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
        -- For crypto symbols like BTC, try both BTC and BTC-USD
        SELECT price INTO latest_price
        FROM public.market_prices
        WHERE ticker_symbol = r.ticker_symbol
           OR ticker_symbol = r.ticker_symbol || '-USD'  -- Try crypto variant
           OR ticker_symbol = (SELECT symbol FROM public.assets WHERE api_id = r.ticker_symbol LIMIT 1) -- Try to map if needed
        ORDER BY recorded_at DESC
        LIMIT 1;

        -- If price exists, calculate achievement rate (direction-agnostic)
        IF latest_price IS NOT NULL THEN
            -- Calculate predicted move (can be positive or negative)
            predicted_move := r.target_price - r.entry_price;
            -- Calculate actual move (can be positive or negative)
            actual_move := latest_price - r.entry_price;
            
            -- Avoid division by zero
            IF predicted_move != 0 THEN
                -- Achievement rate = (actual move / predicted move) × 100
                -- This works for both LONG and SHORT:
                -- - LONG: entry=100, target=110, current=105 → (5/10)×100 = 50%
                -- - SHORT: entry=110, target=100, current=105 → (-5/-10)×100 = 50%
                -- - Opposite direction: entry=100, target=110, current=95 → (-5/10)×100 = -50% → 0%
                calculated_accuracy := (actual_move / predicted_move) * 100;
                
                -- If moved in opposite direction (negative achievement), set to 0
                IF calculated_accuracy < 0 THEN
                    calculated_accuracy := 0;
                END IF;
                
                -- Cap at 100% if overachieved
                IF calculated_accuracy > 100 THEN
                    calculated_accuracy := 100;
                END IF;
            ELSE
                calculated_accuracy := 0;
            END IF;

            -- Update the post
            UPDATE public.posts
            SET accuracy_score = ROUND(calculated_accuracy, 2)
            WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

