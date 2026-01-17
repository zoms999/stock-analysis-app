
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("Loaded .env.local");
} else {
    console.log("No .env.local found");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDebug() {
    console.log("--- Debugging Data State ---");

    // 1. Count Posts by Status
    const { data: posts, error } = await supabase
        .from("posts")
        .select("prediction_status, ticker_symbol");

    if (error) {
        console.error("Error fetching posts:", error);
    } else {
        const statusCounts = {};
        posts.forEach(p => {
            statusCounts[p.prediction_status] = (statusCounts[p.prediction_status] || 0) + 1;
        });
        console.log("Post Status Counts:", statusCounts);

        const waiting = posts.filter(p => p.prediction_status === 'WAITING');
        const waitingSymbols = [...new Set(waiting.map(p => p.ticker_symbol))];
        console.log(`WAITING Symbols (${waitingSymbols.length}):`, waitingSymbols);
    }

    // 2. Count Total Assets of interest
    const { data: allAssets, error: assetError } = await supabase
        .from("assets")
        .select("symbol");
    
    if (allAssets) {
        console.log(`Total Assets in DB: ${allAssets.length}`);
        console.log("Asset Symbols:", allAssets.map(a => a.symbol));
    }
}

runDebug();
