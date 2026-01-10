const pkg = require('yahoo-finance2');
const yahooFinance = pkg.default || pkg;

// Safe instantiation logic from my fix
const yf = typeof yahooFinance === 'function' ? new yahooFinance() : yahooFinance;

async function test(name, opts) {
    console.log(`Testing ${name}...`, JSON.stringify(opts));
    try {
        await yf.historical('AAPL', opts);
        console.log(`✅ ${name} SUCCESS`);
    } catch (e) {
        if (e.errors) {
            console.log(`❌ ${name} FAILED:`, JSON.stringify(e.errors, null, 2));
        } else {
             console.log(`❌ ${name} FAILED:`, e.message);
        }
    }
}

async function run() {
    // 1. String Date YYYY-MM-DD
    await test('String Date', { period1: '2023-01-01', interval: '1d' });
    
    // 2. JS Date Object
    await test('JS Date', { period1: new Date('2023-01-01'), interval: '1d' });

    // 3. Timestamp Number (seconds) - Yahoo usually takes seconds? Or ms?
    // Library docs say: date, string, number. Usually number is seconds for API, but library formats it?
    // Let's try ms (JS timestamp)
    await test('Timestamp ms', { period1: new Date('2023-01-01').getTime(), interval: '1d' });
    
    // 4. Timestamp seconds
    await test('Timestamp seconds', { period1: Math.floor(new Date('2023-01-01').getTime() / 1000), interval: '1d' });

    // 5. Without interval (default)
    await test('No Interval', { period1: '2023-01-01' });

}

run();
