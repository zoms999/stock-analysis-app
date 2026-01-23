import { NextResponse } from 'next/server';
import { getCachedPrice, getBatchPrices } from '@/lib/api/price-cache';

/**
 * 통합 현재가 조회 API (Yahoo Finance 기반)
 * 
 * 단일 조회:
 * GET /api/price?symbol=AAPL
 * 
 * 배치 조회:
 * GET /api/price?symbols=AAPL,TSLA,005930
 * 
 * 응답 형식:
 * {
 *   symbol: "AAPL",
 *   price: 150.25,
 *   previousClose: 149.80,
 *   change: 0.45,
 *   changePercent: 0.30,
 *   timestamp: 1234567890
 * }
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const symbolsParam = searchParams.get('symbols');

    try {
        // 1. 배치 조회
        if (symbolsParam) {
            const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);

            if (symbols.length === 0) {
                return NextResponse.json(
                    { error: 'No valid symbols provided' },
                    { status: 400 }
                );
            }

            if (symbols.length > 50) {
                return NextResponse.json(
                    { error: 'Maximum 50 symbols per request' },
                    { status: 400 }
                );
            }

            const results = await getBatchPrices(symbols);

            // Map을 객체로 변환
            const response: Record<string, any> = {};
            results.forEach((price, sym) => {
                response[sym] = price;
            });

            return NextResponse.json(response, {
                headers: {
                    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
                },
            });
        }

        // 2. 단일 조회
        if (!symbol) {
            return NextResponse.json(
                { error: 'Symbol or symbols parameter is required' },
                { status: 400 }
            );
        }

        // 업비트 코인 체크
        if (symbol.toUpperCase().includes('KRW-')) {
            return NextResponse.json(
                {
                    error: 'Upbit symbols (KRW-*) not supported. Use /api/upbit/ticker instead',
                    suggestion: `/api/upbit/ticker?markets=${symbol}`
                },
                { status: 400 }
            );
        }

        const price = await getCachedPrice(symbol);

        if (!price) {
            return NextResponse.json(
                { error: `No price data available for ${symbol}` },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { symbol: symbol.toUpperCase(), ...price },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
                },
            }
        );

    } catch (error: any) {
        console.error('[Price API] Error:', error);

        if (error.message?.includes('Upbit')) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to fetch price', details: error.message },
            { status: 500 }
        );
    }
}
