import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface UpdateResult {
    success: boolean;
    updated: number;
    failed: number;
    failedSymbols?: string[];
    error?: string;
}

interface PredictionRecord {
    id: string;
    prediction_date: string;
    posts?: { ticker_symbol: string };
}

/**
 * Determine the appropriate data source for a symbol
 * 
 * ✅ Phase 1: Yahoo Finance 중심으로 통합
 * - 업비트 코인 (KRW-*): Upbit API 유지
 * - 나머지 모두: Yahoo Finance (한국 주식 포함)
 */
function getDataSource(symbol: string): 'yahoo' | 'upbit' {
    // Upbit crypto (e.g., KRW-BTC)
    if (symbol.includes('KRW-')) {
        return 'upbit';
    }

    // 나머지는 모두 Yahoo (한국 주식, 미국 주식, 코인 등)
    // 한국 주식: 005930 → 005930.KS로 자동 변환됨
    return 'yahoo';
}

/**
 * Fetch candle data for a symbol
 * 
 * ✅ Phase 1: 통합 차트 API 사용
 */
async function fetchCandleData(symbol: string, retries = 3): Promise<any[] | null> {
    const source = getDataSource(symbol);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            let url: string;

            if (source === 'upbit') {
                // 업비트 API 사용
                url = `${baseUrl}/api/upbit/candles?market=${encodeURIComponent(symbol)}&minutes=1440&count=200`;
            } else {
                // 통합 차트 API 사용 (Yahoo Finance 기반)
                url = `${baseUrl}/api/chart?symbol=${encodeURIComponent(symbol)}&interval=1d`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store'
            });

            if (!response.ok) {
                if (attempt < retries) {
                    console.warn(`[Retry ${attempt}/${retries}] Failed to fetch ${symbol}, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                    continue;
                }
                return null;
            }

            const candles = await response.json();

            if (!Array.isArray(candles) || candles.length < 2) {
                console.warn(`Insufficient candle data for ${symbol}`);
                return null;
            }

            return candles;
        } catch (error) {
            if (attempt < retries) {
                console.warn(`[Retry ${attempt}/${retries}] Error fetching ${symbol}:`, error);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            console.error(`Failed to fetch ${symbol} after ${retries} attempts:`, error);
            return null;
        }
    }

    return null;
}

/**
 * Find the previous close price for a given prediction date
 */
function findPreviousClose(candles: any[], predictionDate: string): number | null {
    // Sort candles by time (ascending)
    const sortedCandles = candles.sort((a, b) => {
        const timeA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time * 1000;
        const timeB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time * 1000;
        return timeA - timeB;
    });

    const predDate = new Date(predictionDate);

    // Find the candle for the day before prediction_date
    for (let i = sortedCandles.length - 1; i >= 0; i--) {
        const candle = sortedCandles[i];
        const candleTime = typeof candle.time === 'string'
            ? new Date(candle.time).getTime()
            : candle.time * 1000;
        const candleDate = new Date(candleTime);

        // Check if this candle is before the prediction date
        if (candleDate < predDate) {
            // ✅ Add Staleness Check: If data is older than 7 days from prediction date, ignore it.
            const diffTime = Math.abs(predDate.getTime() - candleDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays > 7) {
                // console.warn(`[UpdatePreviousClose] Found data but too old (${diffDays} days) for ${predictionDate}`);
                return null;
            }
            return candle.close;
        }
    }

    return null;
}

/**
 * Main function to update previous close prices
 */
export async function updatePreviousClosePrices(): Promise<UpdateResult> {
    console.log('[UpdatePreviousClose] Starting update process...');

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch all predictions that need previous_close updates
        const { data: predictions, error: fetchError } = await supabase
            .from('daily_predictions')
            .select(`
        id,
        post_id,
        prediction_date,
        previous_close,
        posts!inner(ticker_symbol)
      `)
            .is('previous_close', null)
            // ✅ Only process past or today's predictions
            .lte('prediction_date', new Date().toISOString().split('T')[0])
            .order('prediction_date', { ascending: true });

        if (fetchError) {
            console.error('[UpdatePreviousClose] Fetch error:', fetchError);
            return {
                success: false,
                updated: 0,
                failed: 0,
                error: fetchError.message
            };
        }

        if (!predictions || predictions.length === 0) {
            console.log('[UpdatePreviousClose] No predictions need updates');
            return {
                success: true,
                updated: 0,
                failed: 0,
                failedSymbols: []
            };
        }

        console.log(`[UpdatePreviousClose] Found ${predictions.length} predictions to update`);

        // 2. Group by symbol to minimize API calls
        const symbolGroups = new Map<string, PredictionRecord[]>();

        for (const pred of predictions) {
            const symbol = (pred.posts as any)?.ticker_symbol;
            if (!symbol) continue;

            if (!symbolGroups.has(symbol)) {
                symbolGroups.set(symbol, []);
            }
            symbolGroups.get(symbol)!.push({
                id: pred.id,
                prediction_date: pred.prediction_date,
                posts: { ticker_symbol: symbol }
            });
        }

        console.log(`[UpdatePreviousClose] Processing ${symbolGroups.size} unique symbols`);

        // 3. Process each symbol
        let totalUpdated = 0;
        let totalFailed = 0;
        const failedSymbols: string[] = [];

        for (const [symbol, records] of symbolGroups.entries()) {
            console.log(`[UpdatePreviousClose] Processing ${symbol} (${records.length} records)...`);

            // Fetch candle data with retry logic
            const candles = await fetchCandleData(symbol);

            if (!candles) {
                console.error(`[UpdatePreviousClose] Failed to fetch candles for ${symbol}`);
                failedSymbols.push(symbol);
                totalFailed += records.length;
                continue;
            }

            // 4. Update each prediction record
            for (const record of records) {
                const previousClose = findPreviousClose(candles, record.prediction_date);

                if (previousClose === null) {
                    console.warn(`[UpdatePreviousClose] No previous close found for ${symbol} on ${record.prediction_date}`);
                    totalFailed++;
                    continue;
                }

                // Update the record
                const { error: updateError } = await supabase
                    .from('daily_predictions')
                    .update({ previous_close: previousClose })
                    .eq('id', record.id);

                if (updateError) {
                    console.error(`[UpdatePreviousClose] Failed to update record ${record.id}:`, updateError);
                    totalFailed++;
                } else {
                    totalUpdated++;
                }
            }

            console.log(`[UpdatePreviousClose] Completed ${symbol}: ${records.length} records processed`);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`[UpdatePreviousClose] Process completed`);
        console.log(`[UpdatePreviousClose] Updated: ${totalUpdated}, Failed: ${totalFailed}`);

        if (failedSymbols.length > 0) {
            console.log(`[UpdatePreviousClose] Failed symbols:`, failedSymbols.join(', '));
        }

        return {
            success: true,
            updated: totalUpdated,
            failed: totalFailed,
            failedSymbols: failedSymbols.length > 0 ? failedSymbols : undefined
        };

    } catch (error) {
        console.error('[UpdatePreviousClose] Unexpected error:', error);
        return {
            success: false,
            updated: 0,
            failed: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
