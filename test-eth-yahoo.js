/**
 * Test Yahoo Finance API with ETH-USD
 * 
 * This script tests if yahoo-finance2 can fetch data for ETH-USD
 */

const YahooFinance = require('yahoo-finance2').default || require('yahoo-finance2');
const yahooFinance = new YahooFinance();

async function testEthUsd() {
    console.log('Testing Yahoo Finance API with ETH-USD...\n');

    try {
        // Test 1: Quote (current price)
        console.log('Test 1: Fetching quote for ETH-USD...');
        const quote = await yahooFinance.quote('ETH-USD');
        console.log('✅ Quote successful:');
        console.log('  Symbol:', quote.symbol);
        console.log('  Price:', quote.regularMarketPrice);
        console.log('  Previous Close:', quote.regularMarketPreviousClose);
        console.log('  Change:', quote.regularMarketChange);
        console.log('  Change %:', quote.regularMarketChangePercent);
        console.log('');

        // Test 2: Chart (historical data)
        console.log('Test 2: Fetching chart data for ETH-USD...');
        const period1 = new Date();
        period1.setDate(period1.getDate() - 30); // 30 days ago

        const chart = await yahooFinance.chart('ETH-USD', {
            period1: period1.toISOString().split('T')[0],
            interval: '1d',
        });

        console.log('✅ Chart successful:');
        console.log('  Symbol:', chart.meta.symbol);
        console.log('  Currency:', chart.meta.currency);
        console.log('  Exchange:', chart.meta.exchangeName);
        console.log('  Data points:', chart.quotes.length);

        if (chart.quotes.length > 0) {
            const first = chart.quotes[0];
            const last = chart.quotes[chart.quotes.length - 1];
            console.log('  First candle:', {
                date: first.date.toISOString().split('T')[0],
                close: first.close
            });
            console.log('  Last candle:', {
                date: last.date.toISOString().split('T')[0],
                close: last.close
            });
        }
        console.log('');

        // Test 3: Try other crypto symbols
        console.log('Test 3: Testing other crypto symbols...');
        const cryptoSymbols = ['BTC-USD', 'XRP-USD', 'SOL-USD'];

        for (const symbol of cryptoSymbols) {
            try {
                const q = await yahooFinance.quote(symbol);
                console.log(`  ✅ ${symbol}: $${q.regularMarketPrice}`);
            } catch (err) {
                console.log(`  ❌ ${symbol}: ${err.message}`);
            }
        }
        console.log('');

        console.log('🎉 All tests passed! Yahoo Finance works with crypto symbols.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);

        // Provide suggestions
        console.log('\n💡 Suggestions:');
        console.log('  1. Check if yahoo-finance2 is installed: npm install yahoo-finance2');
        console.log('  2. Try alternative symbols: ETH-USD, ETHUSD, ETH');
        console.log('  3. Check Yahoo Finance website: https://finance.yahoo.com/quote/ETH-USD');
        console.log('  4. Consider using alternative data sources for crypto (Upbit, Binance, CoinGecko)');
    }
}

testEthUsd();
