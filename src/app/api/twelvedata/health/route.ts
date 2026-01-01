import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twelve Data env health check (does NOT expose the key)
 * GET /api/twelvedata/health
 */
export async function GET() {
  const hasKey = Boolean(process.env.TWELVEDATA_API_KEY ?? process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY);

  return NextResponse.json(
    {
      ok: true,
      hasKey,
      // 도움용: 환경이 dev인지 확인 (키 값은 절대 노출하지 않음)
      nodeEnv: process.env.NODE_ENV ?? null,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}


