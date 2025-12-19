const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance();

async function test() {
  try {
    const symbol = 'AA';
    console.log(`Testing symbol: ${symbol}`);
    const quote = await yahooFinance.quote(symbol);
    console.log('Result:', JSON.stringify(quote, null, 2));
    console.log('Quote Type:', quote.quoteType);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
