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
    predicted_price?: number;
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

        const result = await processPredictions(predictions);

        console.log(`[UpdatePreviousClose] Process completed`);
        console.log(`[UpdatePreviousClose] Updated: ${result.updated}, Failed: ${result.failed}`);

        if (result.failedSymbols && result.failedSymbols.length > 0) {
            console.log(`[UpdatePreviousClose] Failed symbols:`, result.failedSymbols.join(', '));
        }

        return result;

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

/**
 * Update previous close prices for the last N days
 * (Regardless of whether they are null or not - forcing update)
 */
/**
 * Update previous_close AND actual_close (result) for recent days
 */
export async function updateRecentPreviousClosePrices(days: number = 5): Promise<UpdateResult> {
    console.log(`[UpdateHistory] Starting update for last ${days} days...`);

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - days);

        // Fetch predictions within range
        const { data: predictions, error: fetchError } = await supabase
            .from('daily_predictions')
            .select(`
        id,
        post_id,
        prediction_date,
        previous_close,
        actual_close,
        predicted_price,
        posts!inner(ticker_symbol)
      `)
            .gte('prediction_date', startDate.toISOString().split('T')[0])
            .lte('prediction_date', today.toISOString().split('T')[0])
            .order('prediction_date', { ascending: true });

        if (fetchError) {
            console.error('[UpdateHistory] Fetch error:', fetchError);
            return { success: false, updated: 0, failed: 0, error: fetchError.message };
        }

        if (!predictions || predictions.length === 0) {
            console.log('[UpdateHistory] No predictions found in range');
            return { success: true, updated: 0, failed: 0 };
        }

        console.log(`[UpdateHistory] Found ${predictions.length} predictions to update`);

        // Process with History Update Mode (true = update actual_close & accuracy)
        return await processPredictions(predictions, true);

    } catch (error) {
        console.error('[UpdateHistory] Unexpected error:', error);
        return { success: false, updated: 0, failed: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Shared logic to process a list of predictions
 * @param updateResult If true, also tries to find actual_close and calculate accuracy
 */
async function processPredictions(predictions: any[], updateResult: boolean = false): Promise<UpdateResult> {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 2. Group by symbol to minimize API calls
    const symbolGroups = new Map<string, any[]>();

    for (const pred of predictions) {
        const symbol = (pred.posts as any)?.ticker_symbol;
        if (!symbol) continue;

        if (!symbolGroups.has(symbol)) {
            symbolGroups.set(symbol, []);
        }
        symbolGroups.get(symbol)!.push({
            id: pred.id,
            prediction_date: pred.prediction_date,
            predicted_price: pred.predicted_price,
            posts: { ticker_symbol: symbol }
        });
    }

    console.log(`[ProcessPredictions] Processing ${symbolGroups.size} unique symbols`);

    // 3. Process each symbol
    let totalUpdated = 0;
    let totalFailed = 0;
    const failedSymbols: string[] = [];

    for (const [symbol, records] of symbolGroups.entries()) {
        console.log(`[ProcessPredictions] Processing ${symbol} (${records.length} records)...`);

        // Fetch candle data with retry logic
        const candles = await fetchCandleData(symbol);

        if (!candles) {
            console.error(`[ProcessPredictions] Failed to fetch candles for ${symbol}`);
            failedSymbols.push(symbol);
            totalFailed += records.length;
            continue;
        }

        // 4. Update each prediction record
        const pricesToSave: { ticker_symbol: string; price: number; recorded_at: string }[] = [];

        for (const record of records) {
            const previousClose = findPreviousClose(candles, record.prediction_date);
            
            let actualClose = null;
            let dailyAccuracy = null;
            let updatePayload: any = { previous_close: previousClose };

            if (updateResult) {
                // Find Actual Close (Price ON the prediction date)
                actualClose = findCloseOnDate(candles, record.prediction_date);
                if (actualClose !== null) {
                    updatePayload.actual_close = actualClose;

                    // ✅ Collect for market_prices update
                    // Use the date from prediction_date as the recorded_at timestamp (start of day UTC)
                    pricesToSave.push({
                        ticker_symbol: symbol,
                        price: actualClose,
                        recorded_at: new Date(record.prediction_date + "T00:00:00Z").toISOString()
                    });
                    
                    // Client-side Accuracy Calculation
                    if (previousClose !== null && record.predicted_price) {
                        const predictedMove = record.predicted_price - previousClose;
                        const actualMove = actualClose - previousClose;
                        
                        if (predictedMove !== 0) {
                            let acc = (actualMove / predictedMove) * 100;
                            if (acc < 0) acc = 0;
                            if (acc > 100) acc = 100;
                            updatePayload.daily_accuracy = parseFloat(acc.toFixed(2));
                            updatePayload.calculated_at = new Date().toISOString();
                        } else {
                            updatePayload.daily_accuracy = 0; // No move predicted
                        }
                    }
                }
            }

            if (previousClose === null && (updateResult ? actualClose === null : true)) {
                // If we are in outcome mode, and we found neither, then warn.
                // If we are in prev_close mode, and found no prev_close, warn.
                console.warn(`[ProcessPredictions] Partial/No data found for ${symbol} on ${record.prediction_date}`);
                // Don't fail immediately, try to update what we have if any
            }
            
            if (Object.keys(updatePayload).length > 0) {
                 // Update the record
                const { error: updateError } = await supabase
                    .from('daily_predictions')
                    .update(updatePayload)
                    .eq('id', record.id);

                if (updateError) {
                    console.error(`[ProcessPredictions] Failed to update record ${record.id}:`, updateError);
                    totalFailed++;
                } else {
                    totalUpdated++;
                }
            } else {
                totalFailed++;
            }
        }

        // ✅ 5. Update market_prices table with collected historical prices
        if (pricesToSave.length > 0) {
            console.log(`[ProcessPredictions] Saving ${pricesToSave.length} historical prices to market_prices for ${symbol}`);
            const { error: priceError } = await supabase
                .from('market_prices')
                .upsert(pricesToSave, { 
                    onConflict: 'ticker_symbol, recorded_at' 
                });

            if (priceError) {
                console.error(`[ProcessPredictions] Failed to update market_prices for ${symbol}:`, priceError);
            }
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    return {
        success: true,
        updated: totalUpdated,
        failed: totalFailed,
        failedSymbols: failedSymbols.length > 0 ? failedSymbols : undefined
    };
}

/**
 * Find the close price on the specific date with robust matching
 */
function findCloseOnDate(candles: any[], targetDateStr: string): number | null {
    // 1. Try Strict String Match (Assumes UTC usually)
    const exactMatch = candles.find((c: any) => {
        let cDateStr = '';
        if (typeof c.time === 'string') {
            cDateStr = c.time.split('T')[0];
        } else {
            // Yahoo returned timestamps are often UTC
            const d = new Date(c.time * 1000);
            cDateStr = d.toISOString().split('T')[0];
        }
        return cDateStr === targetDateStr; 
    });

    if (exactMatch) return exactMatch.close;

    // 2. Try Range Match (Handle Timezone differences)
    // Check if candle time is within the target day (UTC or Local ambiguity)
    // We treat targetDateStr as UTC start of day
    const targetStart = new Date(targetDateStr).getTime(); // Local midnight if string is YYYY-MM-DD, or UTC if ISO
    
    // Safety: assume targetDateStr is YYYY-MM-DD
    // If we parse "2025-01-01", it depends on browser/node locale or UTC execution.
    // Let's force UTC interpretation for bounding box
    const utcStart = new Date(targetDateStr + "T00:00:00Z").getTime();
    const utcEnd = utcStart + 86400000;

    const rangeMatch = candles.find((c: any) => {
        let cTime = typeof c.time === 'string' ? new Date(c.time).getTime() : c.time * 1000;
        return cTime >= utcStart && cTime < utcEnd;
    });

    if (rangeMatch) return rangeMatch.close;

    return null;
}
