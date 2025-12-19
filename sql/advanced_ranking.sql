-- Function to get posts ranked by accuracy at a specific timeframe (e.g. 1 day after creation, 5 days, etc.)
-- specific to the logic in plan/main.md
CREATE OR REPLACE FUNCTION get_posts_by_accuracy_days(p_days int, p_limit int DEFAULT 20)
RETURNS SETOF public.posts AS $$
BEGIN
    RETURN QUERY
    WITH PredictionPoints AS (
        SELECT 
            p.id AS post_id,
            p.created_at,
            (point->>'value')::numeric AS predicted_price,
            -- Calc elapsed days from creation to prediction point
            ROUND(EXTRACT(EPOCH FROM (TO_TIMESTAMP((point->>'time')::double precision) - p.created_at)) / 86400) AS days_elapsed
        FROM 
            public.posts p,
            jsonb_array_elements(p.chart_config -> 'prediction_points') AS point
        WHERE p.prediction_status != 'WAITING' -- Optional: Only check finished ones? Or all? Let's checks all.
    ),
    TargetPredictions AS (
        SELECT 
            pp.post_id,
            pp.predicted_price
        FROM PredictionPoints pp
        WHERE pp.days_elapsed = p_days
    ),
    RankedPosts AS (
        SELECT 
            tp.post_id,
            -- Calculate Accuracy: (1 - |pred - actual|/actual) * 100
            -- We join market prices on the target date
            (100 - (ABS(tp.predicted_price - mp.price) / mp.price * 100)) as calc_accuracy
        FROM TargetPredictions tp
        JOIN public.posts p ON p.id = tp.post_id
        JOIN public.market_prices mp ON mp.ticker_symbol = p.ticker_symbol
        -- Match price date to Creation + N days
        WHERE DATE(mp.recorded_at) = DATE(p.created_at + (p_days || ' days')::interval)
    )
    SELECT p.*
    FROM public.posts p
    JOIN RankedPosts rp ON rp.post_id = p.id
    ORDER BY rp.calc_accuracy DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function for "Most Analyzed Tickers" (Trending)
CREATE OR REPLACE FUNCTION get_trending_tickers(p_limit int DEFAULT 5)
RETURNS TABLE (
    ticker_symbol text,
    count bigint,
    last_analyzed_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.ticker_symbol::text, 
        COUNT(*) as count,
        MAX(p.created_at) as last_analyzed_at
    FROM public.posts p
    GROUP BY p.ticker_symbol
    ORDER BY count DESC, last_analyzed_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
