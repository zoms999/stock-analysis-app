const pkg = require('yahoo-finance2');
console.log('Type of pkg:', typeof pkg);
console.log('pkg keys:', Object.keys(pkg));
if (pkg.default) {
    console.log('pkg.default keys:', Object.keys(pkg.default));
}

try {
    const yahooFinance = pkg.default || pkg;
    console.log('Attempting to use yahooFinance instance...');
    yahooFinance.historical('AAPL', { period1: '2023-01-01' }).then(res => {
        console.log('Success with default/pkg export!');
        process.exit(0);
    }).catch(err => {
        console.error('Error with default/pkg export:', err.message);
        
        // Try instantiation if suggested
        try {
            console.log('Attempting new pkg.YahooFinance()...');
            const YF = new pkg.YahooFinance(); // Adjust based on keys if needed
            YF.historical('AAPL', { period1: '2023-01-01' }).then(r => console.log('Success with new instance!'));
        } catch (e) {
            console.error('Instantiation failed:', e.message);
        }
    });
} catch (e) {
    console.error('Top level error:', e);
}
