import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * GET /api/market-prices/candles
 * 
 * Query params:
 * - symbol: ticker symbol (required)
 * - interval: 1d, 1w, 1m (default: 1d)
 * - limit: number of candles to return (default: 100)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval') || '1d';
  const limit = parseInt(searchParams.get('limit') || '100');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    // Fetch price data from market_prices table
    const { data: prices, error } = await supabase
      .from('market_prices')
      .select('ticker_symbol, price, recorded_at')
      .eq('ticker_symbol', symbol)
      .order('recorded_at', { ascending: true })
      .limit(limit * 10); // Fetch more to allow for aggregation

    if (error) {
      console.error('[Candles API] Error fetching prices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!prices || prices.length === 0) {
      // Try with -USD suffix for crypto
      const { data: cryptoPrices, error: cryptoError } = await supabase
        .from('market_prices')
        .select('ticker_symbol, price, recorded_at')
        .eq('ticker_symbol', `${symbol}-USD`)
        .order('recorded_at', { ascending: true })
        .limit(limit * 10);

      if (cryptoError || !cryptoPrices || cryptoPrices.length === 0) {
        return NextResponse.json({ candles: [] });
      }

      return NextResponse.json({ 
        candles: aggregateToCandles(cryptoPrices, interval, limit) 
      });
    }

    // Aggregate prices into OHLC candles
    const candles = aggregateToCandles(prices, interval, limit);

    return NextResponse.json({ candles });
  } catch (error: any) {
    console.error('[Candles API] Internal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Aggregate price records into OHLC candles based on interval
 */
function aggregateToCandles(
  prices: Array<{ price: number; recorded_at: string }>,
  interval: string,
  limit: number
): CandleData[] {
  if (prices.length === 0) return [];

  // Group prices by time bucket based on interval
  const buckets = new Map<number, number[]>();

  prices.forEach(p => {
    const timestamp = new Date(p.recorded_at).getTime();
    const bucketTime = getBucketTime(timestamp, interval);
    
    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, []);
    }
    buckets.get(bucketTime)!.push(p.price);
  });

  // Convert buckets to OHLC candles
  const candles: CandleData[] = [];
  
  Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-limit) // Take only the last 'limit' candles
    .forEach(([time, priceList]) => {
      if (priceList.length === 0) return;

      candles.push({
        time: Math.floor(time / 1000), // Convert to seconds for lightweight-charts
        open: priceList[0],
        high: Math.max(...priceList),
        low: Math.min(...priceList),
        close: priceList[priceList.length - 1],
      });
    });

  return candles;
}

/**
 * Get bucket time based on interval
 */
function getBucketTime(timestamp: number, interval: string): number {
  const date = new Date(timestamp);
  
  switch (interval) {
    case '1d':
      // Bucket by day
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    
    case '1w':
      // Bucket by week (Monday)
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    
    case '1m':
      // Bucket by month
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    
    default:
      // Default to daily
      date.setHours(0, 0, 0, 0);
      return date.getTime();
  }
}
