import { NextResponse } from "next/server";

/**
 * Upbit API Proxy to avoid CORS issues
 * GET /api/upbit/candles?market=KRW-BTC&minutes=240&count=200
 * 
 * Upbit API Response Format:
 * - candle_date_time_kst: "2024-01-24T14:00:00" (KST timezone)
 * - candle_date_time_utc: "2024-01-24T05:00:00" (UTC timezone)
 * - opening_price, high_price, low_price, trade_price (close)
 * - candle_acc_trade_volume (volume)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const market = searchParams.get("market") ?? "KRW-BTC";
    const minutes = searchParams.get("minutes") ?? "240";
    const count = searchParams.get("count") ?? "200";

    const upbitUrl = `https://api.upbit.com/v1/candles/minutes/${minutes}?market=${market}&count=${count}`;

    const response = await fetch(upbitUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = response.statusText;
      try {
           const errorJson = JSON.parse(errorText);
           if (errorJson.error && errorJson.error.message) {
               errorMsg = errorJson.error.message;
           }
      } catch (e) {
          // ignore parsing error, use statusText
      }
      
      console.error(`Upbit API Error (${response.status}):`, errorMsg);

      return NextResponse.json(
        { error: `Upbit API Error: ${errorMsg}` },
        { status: response.status }
      );
    }

    const upbitData = await response.json();

    // ✅ Transform Upbit format to lightweight-charts format
    const transformedData = upbitData.map((candle: any) => {
      // Use UTC time for consistency
      const timestamp = new Date(candle.candle_date_time_utc).getTime();
      
      // For daily/weekly data (240min = 4h), use YYYY-MM-DD format
      // For intraday data (1min, 60min), use Unix timestamp in seconds
      let time: string | number;
      if (parseInt(minutes) >= 240) {
        // Daily-like data: use date string
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        time = `${year}-${month}-${day}`;
      } else {
        // Intraday data: use Unix timestamp in seconds
        time = Math.floor(timestamp / 1000);
      }

      return {
        time,
        open: candle.opening_price,
        high: candle.high_price,
        low: candle.low_price,
        close: candle.trade_price,
        volume: candle.candle_acc_trade_volume,
      };
    }).reverse(); // Upbit returns newest first, we need oldest first

    // ✅ Remove duplicates (keep last occurrence of each unique time)
    // This is necessary because when converting to daily format (YYYY-MM-DD),
    // multiple intraday candles can map to the same date
    const uniqueDataMap = transformedData.reduce((map: Map<string | number, any>, candle: any) => {
      map.set(candle.time, candle);
      return map;
    }, new Map<string | number, any>());
    
    const uniqueData = Array.from(uniqueDataMap.values());

    return NextResponse.json(uniqueData, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Upbit proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Upbit" },
      { status: 500 }
    );
  }
}
