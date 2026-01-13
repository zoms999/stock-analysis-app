-- Create daily_predictions table for tracking daily prediction accuracy
-- This table stores individual prediction points from charts with their daily accuracy

CREATE TABLE IF NOT EXISTS public.daily_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,
    predicted_price NUMERIC NOT NULL,
    previous_close NUMERIC,
    actual_close NUMERIC,
    daily_accuracy NUMERIC,
    calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_post_date UNIQUE(post_id, prediction_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_predictions_post_id ON public.daily_predictions(post_id);
CREATE INDEX IF NOT EXISTS idx_daily_predictions_date ON public.daily_predictions(prediction_date);
CREATE INDEX IF NOT EXISTS idx_daily_predictions_uncalculated ON public.daily_predictions(calculated_at) 
    WHERE calculated_at IS NULL;

-- Add average_daily_accuracy column to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS average_daily_accuracy NUMERIC;

-- Add index for sorting by average accuracy
CREATE INDEX IF NOT EXISTS idx_posts_avg_daily_accuracy 
ON public.posts (average_daily_accuracy DESC NULLS LAST);

-- Comments for documentation
COMMENT ON TABLE public.daily_predictions IS 'Stores daily prediction points and their calculated accuracy';
COMMENT ON COLUMN public.daily_predictions.prediction_date IS 'Date for which the prediction was made';
COMMENT ON COLUMN public.daily_predictions.predicted_price IS 'Price predicted for this date';
COMMENT ON COLUMN public.daily_predictions.previous_close IS 'Previous day closing price (baseline)';
COMMENT ON COLUMN public.daily_predictions.actual_close IS 'Actual closing price for prediction date';
COMMENT ON COLUMN public.daily_predictions.daily_accuracy IS 'Calculated accuracy: (actual_move / predicted_move) × 100';
COMMENT ON COLUMN public.daily_predictions.calculated_at IS 'When accuracy was calculated (NULL = not yet calculated)';

-- Enable Row Level Security
ALTER TABLE public.daily_predictions ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read predictions
DROP POLICY IF EXISTS "Public predictions are viewable by everyone" ON public.daily_predictions;
CREATE POLICY "Public predictions are viewable by everyone" 
ON public.daily_predictions FOR SELECT 
USING (true);

-- Allow authenticated users to insert their own predictions (via API/backend)
DROP POLICY IF EXISTS "Users can insert predictions for their own posts" ON public.daily_predictions;
CREATE POLICY "Users can insert predictions for their own posts" 
ON public.daily_predictions FOR INSERT  
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.posts 
        WHERE id = post_id 
        AND user_id = auth.uid()
    )
);

-- Service role usually bypasses RLS, but if using anon client for updates:
-- Updates are mostly done by system (cron), so service role key should be used.

