import { NextResponse } from "next/server";

/**
 * Upbit API Proxy to avoid CORS issues
 * GET /api/upbit/candles?market=KRW-BTC&minutes=240&count=200
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
      return NextResponse.json(
        { error: `Upbit API Error: ${response.statusText}` },
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
    console.error("Upbit proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Upbit" },
      { status: 500 }
    );
  }
}
