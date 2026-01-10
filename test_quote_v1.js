const pkg = require('yahoo-finance2');
const yahooFinance = pkg.default || pkg;
const yf = typeof yahooFinance === 'function' ? new yahooFinance() : yahooFinance;

async function run() {
    try {
        console.log("Testing quote() for BTC-USD...");
        const quote = await yf.quote('BTC-USD');
        console.log("Quote result keys:", Object.keys(quote));
        console.log("Price:", quote.regularMarketPrice);
    } catch(e) {
        console.error("Error:", e);
    }
}
run();
