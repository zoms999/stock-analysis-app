const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('--- Checking Market Prices for XRP ---');
    const fs = require('fs');
    let output = '';

    const { data: prices, error: priceError } = await supabase
        .from('market_prices')
        .select('*')
        .ilike('ticker_symbol', '%XRP%')
        .order('recorded_at', { ascending: false })
        .limit(50);

    output += '--- Checking Market Prices for XRP ---\n';
    if (prices) {
        output += JSON.stringify(prices.map(p => ({ 
            symbol: p.ticker_symbol, 
            price: p.price, 
            time: new Date(p.recorded_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
            raw_time: p.recorded_at
        })), null, 2);
    }

    output += '\n\n--- Checking Daily Predictions for XRP ---\n';
    // First get the post ID for 'XRP'
    const { data: posts } = await supabase.from('posts').select('id, ticker_symbol').ilike('ticker_symbol', 'XRP').limit(1);

    if (posts && posts.length > 0) {
        const postId = posts[0].id;
        output += `Found Post ID: ${postId} for symbol ${posts[0].ticker_symbol}\n`;

        const { data: predictions, error: predError } = await supabase
            .from('daily_predictions')
            .select('*')
            .eq('post_id', postId)
            .order('prediction_date', { ascending: true });

        if (predictions) {
            output += JSON.stringify(predictions.map(p => ({
                date: p.prediction_date,
                prev_close: p.previous_close,
                predicted: p.predicted_price,
                actual: p.actual_close,
                updated_at: p.calculated_at ? new Date(p.calculated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : 'N/A'
            })), null, 2);
        }
    }
    
    fs.writeFileSync('debug_output.txt', output);
    console.log('Output written to debug_output.txt');
}

main();
