import { NextResponse } from 'next/server';
import { getCachedCandles } from '@/lib/api/price-cache';

/**
 * 통합 차트 데이터 API (Yahoo Finance 기반)
 * 
 * GET /api/chart?symbol=AAPL&interval=1d
 * 
 * 지원 심볼:
 * - 미국 주식: AAPL, TSLA, GOOGL 등
 * - 한국 주식: 005930 (자동으로 005930.KS 변환)
 * - 코인: BTC-USD, ETH-USD 등
 * - 업비트 코인: KRW-BTC (지원 안 함, /api/upbit/candles 사용)
 * 
 * 지원 간격:
 * - 1m, 5m, 15m, 30m, 1h (분/시간봉)
 * - 1d, 1wk, 1mo (일/주/월봉)
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1d';

    // 1. 파라미터 검증
    if (!symbol) {
        return NextResponse.json(
            { error: 'Symbol parameter is required' },
            { status: 400 }
        );
    }

    // 2. 간격 검증
    const validIntervals = ['1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo'];
    if (!validIntervals.includes(interval)) {
        return NextResponse.json(
            { error: `Invalid interval. Supported: ${validIntervals.join(', ')}` },
            { status: 400 }
        );
    }

    // 3. 업비트 코인 체크
    if (symbol.toUpperCase().includes('KRW-')) {
        return NextResponse.json(
            {
                error: 'Upbit symbols (KRW-*) not supported. Use /api/upbit/candles instead',
                suggestion: `/api/upbit/candles?market=${symbol}&minutes=240&count=200`
            },
            { status: 400 }
        );
    }

    try {
        // 4. 캐시된 캔들 데이터 조회 (Rate Limit 방어)
        const candles = await getCachedCandles(
            symbol,
            interval as '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo'
        );

        if (!candles || candles.length === 0) {
            console.error(`[Chart API] No data for ${symbol}`);

            // 더 자세한 에러 메시지
            let suggestion = '';
            if (symbol.toUpperCase().includes('KRW-')) {
                suggestion = 'Upbit symbols (KRW-*) are not supported. Use /api/upbit/candles instead.';
            } else if (['ETH', 'BTC', 'XRP', 'SOL', 'DOGE', 'ADA'].includes(symbol.toUpperCase())) {
                suggestion = `Try using ${symbol.toUpperCase()}-USD format instead of ${symbol}.`;
            } else {
                suggestion = 'Symbol may not be available on Yahoo Finance. Please check the symbol format.';
            }

            return NextResponse.json(
                {
                    error: `No data available for ${symbol}`,
                    suggestion,
                    yahooSymbol: symbol.includes('-USD') ? symbol : `${symbol}-USD (for crypto)`
                },
                { status: 404 }
            );
        }

        // 5. 성공 응답
        return NextResponse.json(candles, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
        });

    } catch (error: any) {
        console.error('[Chart API] Error:', error);

        // 업비트 심볼 에러 처리
        if (error.message?.includes('Upbit')) {
            return NextResponse.json(
                {
                    error: error.message,
                    suggestion: `/api/upbit/candles?market=${symbol}&minutes=240&count=200`
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to fetch chart data', details: error.message },
            { status: 500 }
        );
    }
}
