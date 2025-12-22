
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function test() {
  const symbols = ['TSLA', 'BTC-USD'];
  try {
    const results = await yahooFinance.quote(symbols);
    console.log("Results:", JSON.stringify(results, null, 2));
    
    // Check structure
    const quotes = Array.isArray(results) ? results : [results];
    for(const q of quotes) {
        console.log(`Symbol: ${q.symbol}, Price: ${q.regularMarketPrice}, Time: ${q.regularMarketTime}`);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
