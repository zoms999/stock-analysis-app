-- Test the new accuracy calculation formula

-- Example 1: LONG prediction, 50% achieved
-- Entry: 10000, Target: 11000 (predicted +1000)
-- Current: 10500 (actual +500)
-- Expected: 500/1000 = 50%

SELECT 
    'Example 1: LONG 50%' as test_case,
    10000 as entry_price,
    11000 as target_price,
    10500 as current_price,
    (11000 - 10000) as predicted_move,
    (10500 - 10000) as actual_move,
    ((10500 - 10000)::numeric / (11000 - 10000)::numeric * 100) as calculated_accuracy;

-- Example 2: SHORT prediction, 50% achieved
-- Entry: 11000, Target: 10000 (predicted -1000)
-- Current: 10500 (actual -500)
-- Expected: -500/-1000 = 50%

SELECT 
    'Example 2: SHORT 50%' as test_case,
    11000 as entry_price,
    10000 as target_price,
    10500 as current_price,
    (10000 - 11000) as predicted_move,
    (10500 - 11000) as actual_move,
    ((10500 - 11000)::numeric / (10000 - 11000)::numeric * 100) as calculated_accuracy;

-- Example 3: LONG prediction, moved opposite direction
-- Entry: 10000, Target: 11000 (predicted +1000)
-- Current: 9500 (actual -500)
-- Expected: -500/1000 = -50% → 0%

SELECT 
    'Example 3: LONG opposite' as test_case,
    10000 as entry_price,
    11000 as target_price,
    9500 as current_price,
    (11000 - 10000) as predicted_move,
    (9500 - 10000) as actual_move,
    ((9500 - 10000)::numeric / (11000 - 10000)::numeric * 100) as calculated_accuracy,
    CASE 
        WHEN ((9500 - 10000)::numeric / (11000 - 10000)::numeric * 100) < 0 THEN 0
        ELSE ((9500 - 10000)::numeric / (11000 - 10000)::numeric * 100)
    END as final_accuracy;

-- Example 4: LONG prediction, overachieved
-- Entry: 10000, Target: 11000 (predicted +1000)
-- Current: 12000 (actual +2000)
-- Expected: 2000/1000 = 200% → capped at 100%

SELECT 
    'Example 4: LONG overachieved' as test_case,
    10000 as entry_price,
    11000 as target_price,
    12000 as current_price,
    (11000 - 10000) as predicted_move,
    (12000 - 10000) as actual_move,
    ((12000 - 10000)::numeric / (11000 - 10000)::numeric * 100) as calculated_accuracy,
    CASE 
        WHEN ((12000 - 10000)::numeric / (11000 - 10000)::numeric * 100) > 100 THEN 100
        ELSE ((12000 - 10000)::numeric / (11000 - 10000)::numeric * 100)
    END as final_accuracy;
