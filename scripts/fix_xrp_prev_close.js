const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- Manual Fix for XRP Previous Close ---');
    
    // 1. Get correct 'Previous Close' (Price from Jan 19)
    // We know from debug output it is approx 1.9776 or 1.9788
    const { data: prices } = await supabase
        .from('market_prices')
        .select('*')
        .ilike('ticker_symbol', '%XRP%')
        .order('recorded_at', { ascending: false })
        .limit(1);

    if (!prices || prices.length === 0) {
        console.error('No market prices found for XRP');
        return;
    }

    const latestPrice = prices[0].price; // 1.9788...
    const latestTime = prices[0].recorded_at;
    console.log(`Latest Price: ${latestPrice} at ${latestTime}`);

    // 2. Update Daily Predictions for Jan 20 and Jan 21
    // Logic: Since Jan 19 trading effectively sets the "start" for Jan 20, we use Jan 19 close (or latest) as Jan 20 Prev Close.
    // Ideally we match dates exactly, but for this fix we assume the latest price IS the previous close for future dates.
    
    const datesToFix = ['2026-01-20', '2026-01-21'];
    
    // Get Post ID
    const { data: posts } = await supabase.from('posts').select('id').ilike('ticker_symbol', 'XRP').limit(1);
    if (!posts || posts.length === 0) return;
    const postId = posts[0].id;

    console.log(`Updating predictions for Post ID: ${postId}`);

    for (const date of datesToFix) {
        const { error } = await supabase
            .from('daily_predictions')
            .update({ 
                previous_close: latestPrice,
                calculated_at: new Date().toISOString()
            })
            .eq('post_id', postId)
            .eq('prediction_date', date);
        
        if (error) console.error(`Failed to update ${date}:`, error.message);
        else console.log(`✅ Updated ${date} previous_close to ${latestPrice}`);
    }
}

main();
