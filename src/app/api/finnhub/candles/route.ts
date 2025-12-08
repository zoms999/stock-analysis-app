import { NextResponse } from "next/server";

/**
 * Finnhub API Proxy to avoid CORS issues and hide API key
 * GET /api/finnhub/candles?symbol=AAPL&resolution=D
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") ?? "AAPL";
    const resolution = searchParams.get("resolution") ?? "D";

    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Finnhub API key is not configured" },
        { status: 500 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const from = now - (200 * 24 * 60 * 60); // 200 days ago

    const finnhubUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`;

    const response = await fetch(finnhubUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Finnhub API Error (${response.status}):`, errorText);
      
      return NextResponse.json(
        { 
          error: `Finnhub API Error: ${response.statusText}`,
          status: response.status,
          details: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Finnhub proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Finnhub" },
      { status: 500 }
    );
  }
}
