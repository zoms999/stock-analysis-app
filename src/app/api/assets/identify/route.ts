import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    // 1. Try Yahoo Finance First (covers Stocks & most Crypto)
    const quote = await yahooFinance.quote(symbol);
    
    // Check quoteType
    const quoteType = quote.quoteType;
    let assetType = 'UNKNOWN';

    if (quoteType === 'EQUITY' || quoteType === 'ETF' || quoteType === 'MUTUALFUND') {
      assetType = 'STOCK';
    } else if (quoteType === 'CRYPTOCURRENCY') {
      assetType = 'CRYPTO';
    }

    // If Yahoo found it, we consider it valid.
    return NextResponse.json({ 
      symbol: symbol.toUpperCase(),
      asset_type: assetType,
      valid: true 
    });

  } catch (error: any) {
    console.warn(`Yahoo Finance check failed for ${symbol}:`, error.message);
    
    // Fallback: If Yahoo failed, maybe it's a crypto symbol that needs formatting (e.g. BTC vs BTC-USD)
    // But for now, we'll return UNKNOWN/Invalid and let the client handle it 
    // or maybe try adding "-USD" for crypto?
    
    if (!symbol.includes('-')) {
        try {
            // Retry with -USD for crypto common pattern
            const cryptoSymbol = `${symbol}-USD`;
            const quote = await yahooFinance.quote(cryptoSymbol);
             if (quote.quoteType === 'CRYPTOCURRENCY') {
                return NextResponse.json({ 
                    symbol: symbol.toUpperCase(),
                    asset_type: 'CRYPTO',
                    valid: true
                });
             }
        } catch (retryError) {
            // Ignore retry error
        }
    }

    return NextResponse.json({ 
      symbol: symbol, 
      asset_type: 'UNKNOWN',
      valid: false,
      error: 'Not found'
    });
  }
}
