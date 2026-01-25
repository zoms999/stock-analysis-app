import { NextResponse } from 'next/server';
import { updateRecentPreviousClosePrices } from '@/lib/cron/update-previous-close';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '5', 10);
    
    console.log(`[Cron] Update History - Request received for past ${days} days`);

    try {
        const result = await updateRecentPreviousClosePrices(days);

        if (result.success) {
            return NextResponse.json({
                message: `Successfully updated history for past ${days} days`,
                data: result
            });
        } else {
            return NextResponse.json({
                message: 'Failed to update history',
                error: result.error
            }, { status: 500 });
        }
    } catch (error) {
        console.error('[Cron] Internal error:', error);
        return NextResponse.json({
            message: 'Internal Server Error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
