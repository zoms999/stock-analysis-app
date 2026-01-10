const yahooFinance = require('yahoo-finance2').default;

async function test() {
  try {
    const symbol = 'AAPL';
    const queryOptions = { period1: '2023-01-01', interval: '1d' };
    console.log(`Fetching ${symbol}...`);
    const result = await yahooFinance.historical(symbol, queryOptions);
    console.log('Success!');
    console.log(result.slice(0, 1));
  } catch (error) {
    console.error('Failed:', error);
  }
}

test();
