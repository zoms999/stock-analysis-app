const pkg = require('yahoo-finance2');
const yahooFinance = pkg.default || pkg;
const yf = typeof yahooFinance === 'function' ? new yahooFinance() : yahooFinance;

async function run() {
    try {
        console.log("Testing chart() with 1m...");
        const res = await yf.chart('BTC-USD', { period1: '2025-01-01', interval: '1d' });
        console.log("Result type:", Array.isArray(res) ? 'Array' : typeof res);
        if (typeof res === 'object') {
             console.log("Keys:", Object.keys(res));
             if (res.quotes) console.log("Quotes length:", res.quotes.length);
        }
    } catch(e) {
        console.error("Error:", e);
    }
}
run();
