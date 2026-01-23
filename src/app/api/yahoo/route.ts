import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

// ✅ Yahoo Finance 인스턴스 생성 (v2.12+ 필수)
const yahooFinance = new YahooFinance();

export const runtime = 'nodejs'; // Node.js runtime required for yahoo-finance2

// Simple in-memory cache
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval') || '1d';

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const cacheKey = `${symbol}|${interval}`;
  const now = Date.now();

  // 1. Check Cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      }
    });
  }

  try {
    // 2. Symbol Normalization
    let yahooSymbol = symbol;

    // Normalize logic
    // KRX (Prefix or Suffix)
    // Case 1: KRX:005930 (Twelve Data style regex I had)
    const mKrPrefix = yahooSymbol.match(/^(KRX|XKRX)\s*:\s*(\d{6})$/i);
    // Case 2: 005930:KRX (Twelve Data typical output)
    const mKrSuffix = yahooSymbol.match(/^(\d{6})\s*:\s*(KRX|XKRX)$/i);

    if (mKrPrefix) {
      yahooSymbol = `${mKrPrefix[2]}.KS`;
    } else if (mKrSuffix) {
      yahooSymbol = `${mKrSuffix[1]}.KS`;
    } else if (/^\d{6}$/.test(yahooSymbol)) {
      yahooSymbol = `${yahooSymbol}.KS`;
    }

    // Crypto
    if (yahooSymbol.includes('/')) yahooSymbol = yahooSymbol.replace('/', '-'); // BTC/USD -> BTC-USD
    // BTC -> BTC-USD (if no dash/slash/colon)
    // Only apply if it looks like a ticker without structure
    if (!yahooSymbol.includes('-') && !yahooSymbol.includes('.') && !yahooSymbol.includes(':')) {
      const isCrypto = ["BTC", "ETH", "XRP", "DOGE", "SOL", "ADA", "DOT", "MATIC"].includes(yahooSymbol.toUpperCase());
      if (isCrypto) yahooSymbol = `${yahooSymbol.toUpperCase()}-USD`;
    }

    // Indices Mapping
    if (yahooSymbol.toUpperCase() === 'KOSPI') yahooSymbol = '^KS11';
    if (yahooSymbol.toUpperCase() === 'KOSDAQ') yahooSymbol = '^KQ11';
    if (yahooSymbol.toUpperCase() === 'SPX' || yahooSymbol.toUpperCase() === 'S&P500') yahooSymbol = '^GSPC';
    if (yahooSymbol.toUpperCase() === 'DJI') yahooSymbol = '^DJI';
    if (yahooSymbol.toUpperCase() === 'IXIC') yahooSymbol = '^IXIC';

    // 3. Fetch from Yahoo Finance
    const validIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'];
    const safeInterval = validIntervals.includes(interval) ? interval : '1d';

    let period1 = '2020-01-01';
    if (['1m', '5m', '15m', '30m', '1h'].includes(safeInterval)) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      period1 = d.toISOString().split('T')[0];
    }

    // Safely get client (handle CJS/ESM interop where default might be Class)
    const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : yahooFinance;

    // Use 'chart' method instead of 'historical' because 'historical' does not support intraday intervals (1m, 5m, etc.)
    const result = await yf.chart(yahooSymbol, {
      period1: period1,
      interval: safeInterval as any,
    });

    // Validating result structure
    // yf.chart returns { meta: {...}, quotes: [...] }
    if (!result || !result.quotes || !Array.isArray(result.quotes)) {
      throw new Error("Invalid response from Yahoo Finance (chart)");
    }

    // 4. Format Data for Lightweight Charts
    const formattedData = result.quotes.map((item: any) => {
      // For daily/weekly/monthly, use YYYY-MM-DD string
      let time: string | number;
      if (['1d', '1wk', '1mo'].includes(safeInterval)) {
        time = item.date.toISOString().split('T')[0];
      } else {
        time = Math.floor(item.date.getTime() / 1000);
      }

      return {
        time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      };
    }).filter((item: any) => item.open !== null && item.close !== null); // Filter null candles

    // Sort just in case
    formattedData.sort((a: any, b: any) => {
      if (typeof a.time === 'string' && typeof b.time === 'string') return a.time.localeCompare(b.time);
      return (a.time as number) - (b.time as number);
    });

    // 5. Save to Cache
    cache.set(cacheKey, { data: formattedData, expiresAt: now + CACHE_DURATION });

    return NextResponse.json(formattedData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      }
    });
  } catch (error: any) {
    console.error(`Yahoo API Error [${symbol}]:`, error); // Log full object
    return NextResponse.json({
      error: 'Failed to fetch data',
      details: error.message,
      debug_symbol: symbol
    }, { status: 500 });
  }
}
