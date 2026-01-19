const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Checking market_prices for XRP...');
    const { data, error } = await supabase
        .from('market_prices')
        .select('*')
        .ilike('ticker_symbol', '%XRP%')
        .gt('price', 1000)
        .order('recorded_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error(error);
    } else {
        const fs = require('fs');
        fs.writeFileSync('xrp_result.txt', JSON.stringify(data, null, 2));
        console.log('Written to xrp_result.txt');
    }
}

main();
