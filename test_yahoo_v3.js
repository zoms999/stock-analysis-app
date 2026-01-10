const pkg = require('yahoo-finance2');
const YahooFinance = pkg.default; // or pkg if default is undefined

console.log('Trying new YahooFinance()...');
try {
    const yf = new YahooFinance();
    console.log('Instance created.');
    yf.historical('AAPL', { period1: '2023-01-01', interval: '1d' })
      .then(r => console.log('Historical success! Rows:', r.length))
      .catch(e => console.error('Historical failed:', e.message));
} catch(e) {
    console.log('Instantiation failed:', e.message);
    // Maybe pkg matches the instance directly?
}
