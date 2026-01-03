import { NextResponse } from "next/server";
import { fetchKisCandles } from "@/lib/api/kis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval") ?? "1d";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const candles = await fetchKisCandles(symbol, interval);
    
    return NextResponse.json(candles, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[KIS Candle API Error] ${symbol}:`, errorMessage);
    
    return NextResponse.json(
      { error: "국내 주식 차트 데이터를 불러올 수 없습니다.", details: errorMessage },
      { status: 500 }
    );
  }
}
