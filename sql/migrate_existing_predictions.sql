-- Migrate existing prediction points to daily_predictions table
-- This allows old posts to show daily accuracy history

DO $$
DECLARE
    p RECORD;
    point RECORD;
    point_date DATE;
    point_value NUMERIC;
    inserted_count INTEGER := 0;
BEGIN
    FOR p IN 
        SELECT id, chart_config
        FROM public.posts 
        WHERE chart_config->'prediction_points' IS NOT NULL
          AND jsonb_array_length(chart_config->'prediction_points') > 0
    LOOP
        -- Loop through each point in prediction_points array
        FOR point IN 
            SELECT * FROM jsonb_to_recordset(p.chart_config->'prediction_points') AS x(time jsonb, value numeric)
        LOOP
            -- Handle time format (can be numeric timestamp or string date)
            IF jsonb_typeof(point.time) = 'number' THEN
                point_date := to_timestamp((point.time)::numeric)::date;
            ELSE
                point_date := (point.time #>> '{}')::date;
            END IF;
            
            point_value := point.value;
            
            -- Insert into daily_predictions if not exists
            BEGIN
                INSERT INTO public.daily_predictions (post_id, prediction_date, predicted_price)
                VALUES (p.id, point_date, point_value)
                ON CONFLICT (post_id, prediction_date) DO NOTHING;
                
                inserted_count := inserted_count + 1;
            EXCEPTION WHEN OTHERS THEN
                -- Ignore errors for individual points
                RAISE NOTICE 'Error inserting point for post %: %', p.id, SQLERRM;
            END;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Migration completed. Processed prediction points.';
END $$;
