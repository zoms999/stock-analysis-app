import { NextResponse } from 'next/server';
import { updatePreviousClosePrices } from '@/lib/cron/update-previous-close';

/**
 * Cron Job: Update Previous Close Prices
 * 
 * Schedule: Daily at 09:30 KST (00:30 UTC)
 * Purpose: Update previous_close for all daily_predictions records
 * 
 * Why 09:30 KST?
 * - Crypto (Upbit): Daily candle resets at 09:00 KST
 * - US Stocks: Market closed at 06:00 KST (05:00 during DST)
 * - KR Stocks: Market closed at 15:30 KST (previous day)
 * 
 * This is the "golden time" when all markets have settled data.
 * 
 * Retry Strategy:
 * - 1st attempt: 09:30 KST (00:30 UTC)
 * - 2nd attempt: 10:00 KST (01:00 UTC) - if needed
 * - 3rd attempt: 10:30 KST (01:30 UTC) - final retry
 */
export async function GET(request: Request) {
    const startTime = new Date();
    console.log('[Cron] Update Previous Close - Started at', startTime.toISOString());

    try {
        const result = await updatePreviousClosePrices();

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        console.log(`[Cron] Update Previous Close - Completed in ${duration}ms`);
        console.log(`[Cron] Result:`, result);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    duration: `${duration}ms`
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            updated: result.updated,
            failed: result.failed,
            failedSymbols: result.failedSymbols,
            duration: `${duration}ms`,
            message: `Updated ${result.updated} records${result.failed > 0 ? `, ${result.failed} failed` : ''}`
        });

    } catch (error) {
        console.error('[Cron] Internal error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
