
// KRX 종목 코드 -> 한글 종목명 매핑
// 주요 인기 종목 위주로 구성 (필요 시 확장)
export const KRX_SYMBOL_TO_NAME: Record<string, string> = {
  // 반도체/IT
  "005930:KRX": "삼성전자",
  "000660:KRX": "SK하이닉스",
  "009150:KRX": "삼성전기",
  "006400:KRX": "삼성SDI",
  "011070:KRX": "LG이노텍",
  "034220:KRX": "LG디스플레이",
  "018260:KRX": "삼성SDS",
  "036570:KRX": "엔씨소프트",
  "251270:KRX": "넷마블",
  "259960:KRX": "크래프톤",
  "263750:KRX": "펄어비스",

  // 플랫폼/서비스
  "035720:KRX": "카카오",
  "035420:KRX": "NAVER",
  "352820:KRX": "하이브",
  "017670:KRX": "SK텔레콤",
  "030200:KRX": "KT",
  "032640:KRX": "LG유플러스",

  // 2차전지/화학
  "373220:KRX": "LG에너지솔루션",
  "051910:KRX": "LG화학",
  "003670:KRX": "포스코퓨처엠",
  "086520:KRX": "에코프로",
  "247540:KRX": "에코프로비엠",
  "066970:KRX": "엘앤에프",
  "009830:KRX": "한화솔루션",
  "010130:KRX": "고려아연",

  // 자동차/기계/운송
  "005380:KRX": "현대차",
  "000270:KRX": "기아",
  "012330:KRX": "현대모비스",
  "086280:KRX": "현대글로비스",
  "064350:KRX": "현대로템",
  "012450:KRX": "한화에어로스페이스",
  "034020:KRX": "두산에너빌리티",
  "003490:KRX": "대한항공",
  "020560:KRX": "아시아나항공",

  // 금융
  "105560:KRX": "KB금융",
  "055550:KRX": "신한지주",
  "086790:KRX": "하나금융지주",
  "316140:KRX": "우리금융지주",
  "032830:KRX": "삼성생명",
  "000810:KRX": "삼성화재",
  "006800:KRX": "미래에셋증권",
  "071050:KRX": "한국금융지주",
  "323410:KRX": "카카오뱅크",
  "377300:KRX": "카카오페이",

  // 바이오
  "207940:KRX": "삼성바이오로직스",
  "068270:KRX": "셀트리온",
  "326030:KRX": "SK바이오팜",
  "000100:KRX": "유한양행",
  "128940:KRX": "한미약품",
  "006280:KRX": "녹십자",

  // 소비재
  "066570:KRX": "LG전자",
  "028260:KRX": "삼성물산",
  "090430:KRX": "아모레퍼시픽",
  "271560:KRX": "오리온",
  "003230:KRX": "삼양식품",
  "004170:KRX": "신세계",
  "023530:KRX": "롯데쇼핑",
  "097950:KRX": "CJ제일제당",

  // 철강/건설/지주
  "005490:KRX": "POSCO홀딩스",
  "004020:KRX": "현대제철",
  "006360:KRX": "GS건설",
  "000720:KRX": "현대건설",
  "003550:KRX": "LG",
  "034730:KRX": "SK",
  "004990:KRX": "롯데지주",
  "000150:KRX": "두산",
  "015760:KRX": "한국전력",
};

export function getKoreanName(symbol: string): string | null {
  // 1. 정확히 일치 (예: 005930:KRX)
  if (KRX_SYMBOL_TO_NAME[symbol]) {
    return KRX_SYMBOL_TO_NAME[symbol];
  }

  // 2. 접미사 보정 (예: 005930.KS -> 005930:KRX)
  // Yahoo ticker (.KS, .KQ) handling
  if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) {
    const code = symbol.slice(0, 6);
    const normalized = `${code}:KRX`;
    return KRX_SYMBOL_TO_NAME[normalized] || null;
  }
  
  // 3. 숫자만 있는 경우
  if (/^\d{6}$/.test(symbol)) {
    const normalized = `${symbol}:KRX`;
    return KRX_SYMBOL_TO_NAME[normalized] || null;
  }

  return null;
}
