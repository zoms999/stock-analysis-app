
export interface CandleData {
  time: string | number; // Upbit returns strings, lightweight-charts needs number (seconds) or string (YYYY-MM-DD)
  open: number;
  high: number;
  low: number;
  close: number;
}

export async function fetchUpbitCandles(market: string = "KRW-BTC", count: number = 200, unit: number = 240): Promise<CandleData[]> {
  try {
    // unit: minutes. 1, 3, 5, 10, 15, 30, 60, 240
    const url = `https://api.upbit.com/v1/candles/minutes/${unit}?market=${market}&count=${count}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Upbit API Error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform data for Lightweight Charts
    // Upbit returns data in reverse chronological order (newest first).
    // Lightweight Charts expects chronological order (oldest first).
    const sortedData = data.reverse().map((item: any) => ({
      // Upbit timestamps are in milliseconds, chart wants seconds for unix timestamp
      time: Math.floor(item.timestamp / 1000), // KST adjustment not needed for unix timestamp in lightweight-charts by default (it uses local time or UTC) 
      // Lightweight charts handles UTC timestamps. Upbit returns UTC timestamp.
      // Actually item.timestamp is mostly enough, but let's check. 
      // Upbit: candle_date_time_utc, candle_date_time_kst, timestamp.
      // Let's use timestamp / 1000 (seconds).
      // Note: Lightweight charts time scale is UTC by default.
      
      open: item.opening_price,
      high: item.high_price,
      low: item.low_price,
      close: item.trade_price,
    }));

    // Fix time zone offset if necessary.
    // For simplicity, we just pass the unix timestamp (seconds).
     const finalData = sortedData.map((d: any) => ({
        ...d,
        time: d.time as number
     }))

    return finalData;

  } catch (error) {
    console.error("Failed to fetch upbit candles:", error);
    return [];
  }
}

export async function fetchUpbitTicker(markets: string = "KRW-BTC") {
    try {
        const url = `https://api.upbit.com/v1/ticker?markets=${markets}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Ticker fetch failed");
        return await response.json();
    } catch (e) {
        console.error(e);
        return null;
    }
}
