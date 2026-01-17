import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { updateMarketPrices } from '../src/lib/price-scheduler';

async function main() {
    console.log("Running updateMarketPrices test...");
    try {
        const result = await updateMarketPrices();
        console.log("Result:", result);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

main();
