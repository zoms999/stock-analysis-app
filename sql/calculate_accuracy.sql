-- 1. Add accuracy_score column to posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS accuracy_score numeric;

-- Index for sorting by accuracy
CREATE INDEX IF NOT EXISTS idx_posts_accuracy_score ON public.posts (accuracy_score DESC NULLS LAST);

-- 2. Function to Calculate Accuracy
-- This function iterates through ACTIVE posts and updates their accuracy_score.
-- Logic: 
--   If prediction_type = 'LONG': (CurrentPrice - EntryPrice) / EntryPrice * 100
--   If prediction_type = 'SHORT': (EntryPrice - CurrentPrice) / EntryPrice * 100
--   Note: We use the *Latest* price available in market_prices for the post's ticker.

CREATE OR REPLACE FUNCTION public.calculate_and_update_accuracies()
RETURNS void AS $$
DECLARE
    r RECORD;
    latest_price numeric;
    calculated_accuracy numeric;
BEGIN
    -- Loop through posts that have a prediction (and strictly speaking, are not finished? Or we assume we update waiting ones live?)
    -- Let's update ALL posts that are WAITING or recently finished to keep score fresh.
    -- For efficiency, let's target posts with prediction_status = 'WAITING'
    FOR r IN 
        SELECT id, ticker_symbol, entry_price, prediction_type 
        FROM public.posts 
        WHERE prediction_status = 'WAITING' 
          AND entry_price IS NOT NULL 
          AND entry_price > 0
          AND prediction_type IS NOT NULL
    LOOP
        -- Get the specific latest price for this ticker from market_prices
        SELECT price INTO latest_price
        FROM public.market_prices
        WHERE ticker_symbol = r.ticker_symbol
          OR ticker_symbol = (SELECT symbol FROM public.assets WHERE api_id = r.ticker_symbol LIMIT 1) -- Try to map if needed
        ORDER BY recorded_at DESC
        LIMIT 1;

        -- If price exists, calculate
        IF latest_price IS NOT NULL THEN
            IF r.prediction_type = 'LONG' THEN
                calculated_accuracy := ((latest_price - r.entry_price) / r.entry_price) * 100;
            ELSIF r.prediction_type = 'SHORT' THEN
                calculated_accuracy := ((r.entry_price - latest_price) / r.entry_price) * 100;
            END IF;

            -- Update the post
            UPDATE public.posts
            SET accuracy_score = ROUND(calculated_accuracy, 2)
            WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
