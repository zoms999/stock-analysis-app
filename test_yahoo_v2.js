const pkg = require('yahoo-finance2');
const yf = pkg.default;
console.log('yf type:', typeof yf);
console.log('yf keys:', Object.keys(yf));
console.log('Is historical a function?', typeof yf.historical);

try {
  yf.historical('AAPL', { period1: '2023-01-01', interval: '1d' })
    .then(r => console.log('Historical success, rows:', r.length))
    .catch(e => console.error('Historical failed:', e.message));
} catch (error) {
  console.error('Call failed:', error);
}
