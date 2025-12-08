import { NextResponse } from "next/server";

/**
 * Upbit Ticker API Proxy to avoid CORS issues
 * GET /api/upbit/ticker?markets=KRW-BTC
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const markets = searchParams.get("markets") ?? "KRW-BTC";

    const upbitUrl = `https://api.upbit.com/v1/ticker?markets=${markets}`;

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
    console.error("Upbit ticker proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticker from Upbit" },
      { status: 500 }
    );
  }
}
