import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import YahooFinance from "yahoo-finance2";
import { fetchKisPrice } from '@/lib/api/kis';

// Re-implement or import helper functions if needed for isolation
function normalizeSymbolForYahoo(symbol: string) {
    let s = symbol.trim();
    const mKr = s.match(/^(KRX|XKRX)\s*:\s*(\d{6})$/i);
    if (mKr) return `${mKr[2]}.KS`;
    if (/^\d{6}$/.test(s)) return `${s}.KS`;
    if (s.includes("/")) return s.replace("/", "-");
    const isCrypto = ["BTC", "ETH", "XRP", "DOGE", "SOL", "ADA", "DOT", "BNB"].includes(s.toUpperCase());
    if (isCrypto) return `${s.toUpperCase()}-USD`;
    return s;
}

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const report: any = {
        scanTime: new Date().toISOString(),
        assets: [],
        classification: { kis: [], crypto: [], yahoo: [] },
        results: { success: [], params: [], errors: [] }
    };

    // 1. Get Assets
    const { data: assets, error } = await supabase.from("assets").select("symbol");
    if (error) return NextResponse.json({ error });
    
    report.assets = assets?.map(a => a.symbol);

    // 2. Classify
    const CRYPTO_LIST = ["BTC", "ETH", "XRP", "DOGE", "SOL", "ADA", "DOT", "BNB", "BTC=F"];
    const uniqueSymbols = Array.from(new Set(report.assets));

    for (const sym of uniqueSymbols as string[]) {
        const s = sym.trim();
        if (/^(KRX|XKRX)\s*:\s*\d{6}$/i.test(s) || /^\d{6}\s*:\s*(KRX|XKRX)$/i.test(s) || /^\d{6}$/.test(s)) {
            report.classification.kis.push(s);
        } else if (CRYPTO_LIST.includes(s.toUpperCase()) || s.includes("USDT")) {
            report.classification.crypto.push(s);
        } else {
            report.classification.yahoo.push(s);
        }
    }

    // 3. Test Fetches (Sample 1 from each or all? Let's try all but limited to avoid timeout)
    // Testing KIS
    for (const sym of report.classification.kis) {
        try {
            const price = await fetchKisPrice(sym);
            if (price) report.results.success.push({ source: 'KIS', symbol: sym, price });
            else report.results.errors.push({ source: 'KIS', symbol: sym, error: 'Returned null' });
        } catch (e: any) {
            report.results.errors.push({ source: 'KIS', symbol: sym, error: e.message });
        }
    }

    // Testing Yahoo (Sample 3)
    for (const sym of report.classification.yahoo.slice(0, 3)) {
         try {
            const ySymbol = normalizeSymbolForYahoo(sym);
            const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });
            const quote = await yf.quote(ySymbol);
            report.results.success.push({ source: 'Yahoo', symbol: sym, price: quote.regularMarketPrice });
        } catch (e: any) {
            report.results.errors.push({ source: 'Yahoo', symbol: sym, error: e.message });
        }
    }

    // 4. Test Final DB Insert (Write Permission Check)
    const writeTest: { success: boolean; error: any } = { success: false, error: null };
    try {
        const testRecord = {
            ticker_symbol: 'BTC', // Must exist in assets
            price: 99999,
            recorded_at: new Date().toISOString()
        };
        const { error: testError } = await supabase.from("market_prices").insert([testRecord]).select();
        if (testError) {
            writeTest.error = testError;
        } else {
            writeTest.success = true;
            // Immediate cleanup
            await supabase.from("market_prices").delete().eq("price", 99999);
        }
    } catch (e: any) {
        writeTest.error = e.message;
    }
    report.dbWriteTest = writeTest;

    return NextResponse.json(report);
}
