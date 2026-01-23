/**
 * 업비트 코인 목록 (하드코딩)
 * 
 * Yahoo Finance는 KRW 페어를 지원하지 않으므로
 * 업비트 코인은 별도로 관리합니다.
 */

export interface UpbitCoin {
    symbol: string; // KRW-BTC
    name: string; // 비트코인
    nameEn: string; // Bitcoin
}

export const UPBIT_COINS: UpbitCoin[] = [
    { symbol: 'KRW-BTC', name: '비트코인', nameEn: 'Bitcoin' },
    { symbol: 'KRW-ETH', name: '이더리움', nameEn: 'Ethereum' },
    { symbol: 'KRW-XRP', name: '리플', nameEn: 'Ripple' },
    { symbol: 'KRW-SOL', name: '솔라나', nameEn: 'Solana' },
    { symbol: 'KRW-DOGE', name: '도지코인', nameEn: 'Dogecoin' },
    { symbol: 'KRW-ADA', name: '에이다', nameEn: 'Cardano' },
    { symbol: 'KRW-AVAX', name: '아발란체', nameEn: 'Avalanche' },
    { symbol: 'KRW-MATIC', name: '폴리곤', nameEn: 'Polygon' },
    { symbol: 'KRW-DOT', name: '폴카닷', nameEn: 'Polkadot' },
    { symbol: 'KRW-LINK', name: '체인링크', nameEn: 'Chainlink' },
    { symbol: 'KRW-ATOM', name: '코스모스', nameEn: 'Cosmos' },
    { symbol: 'KRW-NEAR', name: '니어프로토콜', nameEn: 'NEAR Protocol' },
    { symbol: 'KRW-SUI', name: '수이', nameEn: 'Sui' },
    { symbol: 'KRW-APT', name: '앱토스', nameEn: 'Aptos' },
    { symbol: 'KRW-ARB', name: '아비트럼', nameEn: 'Arbitrum' },
    { symbol: 'KRW-OP', name: '옵티미즘', nameEn: 'Optimism' },
    { symbol: 'KRW-HBAR', name: '헤데라', nameEn: 'Hedera' },
    { symbol: 'KRW-STX', name: '스택스', nameEn: 'Stacks' },
    { symbol: 'KRW-SEI', name: '세이', nameEn: 'Sei' },
    { symbol: 'KRW-TIA', name: '셀레스티아', nameEn: 'Celestia' },
];

/**
 * 업비트 코인 검색
 * 
 * @param query 검색어 (한글/영문)
 * @returns 매칭되는 코인 목록
 */
export function searchUpbitCoins(query: string): UpbitCoin[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return UPBIT_COINS.filter((coin) => {
        const symbolMatch = coin.symbol.toLowerCase().includes(q);
        const nameMatch = coin.name.toLowerCase().includes(q);
        const nameEnMatch = coin.nameEn.toLowerCase().includes(q);

        return symbolMatch || nameMatch || nameEnMatch;
    });
}

/**
 * 심볼로 업비트 코인 찾기
 * 
 * @param symbol 심볼 (예: KRW-BTC)
 * @returns 코인 정보 또는 undefined
 */
export function getUpbitCoin(symbol: string): UpbitCoin | undefined {
    return UPBIT_COINS.find((coin) => coin.symbol.toUpperCase() === symbol.toUpperCase());
}
