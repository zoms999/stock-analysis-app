const { YahooFinance } = require('yahoo-finance2');
const yahoo = new YahooFinance();

async function test() {
    try {
        const symbol = 'BTC-USD';
        const result = await yahoo.historical(symbol, {
            period1: '2023-01-01',
            interval: '1d',
        });
        console.log('Success:', result.length, 'records');
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
