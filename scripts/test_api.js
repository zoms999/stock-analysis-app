// Native fetch is available in Node 22

async function main() {
  try {
    // Assuming next.js is running on port 3000
    const url = 'http://localhost:3000/api/market-prices/candles?symbol=XRP&limit=10';
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Fetch failed:', e.message);
  }
}

main();
