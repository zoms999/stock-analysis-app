const { createClient } = require('@supabase/supabase-js');
// const { fetchYahooCandles } = require('../src/lib/api/yahoo');
// Since we can't easily import the app code in a standalone JS script without setup, 
// I will rewrite the core logic in this script to reproduce it.

const dotenv = require('dotenv');
const path = require('path');
const yahooFinance = require('yahoo-finance2').default; // Using direct yahoo-finance2 for reproduction

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase Env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUpdate() {
  console.log("=== Debugging 5-Day Logic ===\n");

  // 1. Fetch 1 target prediction
  const days = 10;
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - days);

  const { data: predictions, error } = await supabase
    .from('daily_predictions')
    .select(`
        id,
        prediction_date,
        previous_close,
        actual_close,
        posts!inner(ticker_symbol)
      `)
    .gte('prediction_date', startDate.toISOString().split('T')[0])
    .limit(5);

  if (error) {
    console.error("DB Error:", error);
    return;
  }

  console.log(`Found ${predictions.length} predictions to check.`);

  for (const p of predictions) {
    const symbol = p.posts.ticker_symbol;
    const date = p.prediction_date;
    console.log(`\n[${symbol}] Prediction Date: ${date}`);
    console.log(`   Current DB Stats - Prev: ${p.previous_close}, Actual: ${p.actual_close}`);

    // 2. Fetch Candles (Yahoo)
    // Normalize symbol
    let ySymbol = symbol;
    if (/^\d{6}$/.test(symbol)) ySymbol = `${symbol}.KS`;
    if (['BTC', 'ETH', 'XRP', 'SOL'].includes(symbol)) ySymbol = `${symbol}-USD`;

    console.log(`   Fetching Yahoo data for ${ySymbol}...`);
    try {
        // Fetch last 30 days to be safe
        const queryOptions = { period1: startDate, interval: '1d' };
        const result = await yahooFinance.chart(ySymbol, queryOptions);
        
        if (!result || !result.quotes || result.quotes.length === 0) {
            console.log("   ❌ No quotes returned");
            continue;
        }

        const quotes = result.quotes;
        console.log(`   ✅ Got ${quotes.length} candles.`);
        
        // Log first few dates to see format
        if (quotes.length > 0) {
             console.log(`   Sample Date 0: ${quotes[0].date} type: ${typeof quotes[0].date}`);
             console.log(`   Sample ISO 0: ${new Date(quotes[0].date).toISOString()}`);
        }

        // 3. Match Date Logic
        let found = false;
        for (const q of quotes) {
            const qDate = new Date(q.date).toISOString().split('T')[0];
            
            if (qDate === date) {
                console.log(`   🎯 MATCH FOUND! Date: ${qDate}, Close: ${q.close}`);
                found = true;
            }
        }
        if (!found) {
            console.log(`   ⚠️ NO MATCH found for ${date}. Closest candles:`);
            quotes.slice(-5).forEach(q => console.log(`       ${q.date.toISOString().split('T')[0]} : ${q.close}`));
        }

    } catch (e) {
        console.error("   ❌ Yahoo Fetch Error:", e.message);
    }
  }
}

debugUpdate();
