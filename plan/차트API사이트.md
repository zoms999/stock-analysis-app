요청하신 파일들의 차트 및 시세 데이터 API 출처를 분석한 결과입니다.

대부분의 데이터는 Yahoo Finance를 주력으로 사용하고 있으며, Upbit는 한국 원화(KRW) 코인 차트에만 제한적으로 사용됩니다.

1. src/app/analyze/page.tsx (차트 작성 페이지)
차트를 그리기 위한 캔들(Candle) 데이터를 가져옵니다.

기본 (해외주식, 암호화폐, 국내주식): Yahoo Finance
API 경로: /api/chart
한국 코인 (KRW- 로 시작하는 심볼): Upbit
API 경로: /api/upbit/candles
코드 로직: 심볼이 KRW-로 시작하면 자동으로 Upbit API를 호출하도록 분기되어 있습니다.
2. src/app/posts/[id]/page.tsx (차트 상세 페이지)
작성된 예측글의 상세 정보를 보여줍니다.

현재가(Current Price): Yahoo Finance
함수: getCurrentPrice(..., "yahoo")를 명시적으로 호출합니다.
차트 뷰어: 저장된 이미지와 데이터를 사용하므로 별도 통신은 없으나, 내부적으로 Yahoo 기반 데이터를 시각화합니다.
정확도 테이블: Supabase DB (daily_predictions 테이블)의 저장된 데이터를 불러옵니다.
3. src/components/home/ChartBoardList.tsx (메인 리스트)
메인 화면의 카드 리스트입니다.

실시간 가격 (Cards): Yahoo Finance (Polling)
함수: subscribePrices (from price-polling.ts)
방식: 웹소켓 대신 10초 간격으로 /api/price를 호출하여 야후 파이낸스 가격을 가져옵니다. (주석에 "Phase 2: Yahoo Finance 기반 폴링"으로 명시됨)
게시글 데이터: Supabase DB
4. src/app/posts/page.tsx (게시판 리스트)
전체 게시글 목록 페이지입니다.

실시간 가격: Yahoo Finance (Polling)
ChartBoardList와 동일하게 subscribePrices를 사용하여 야후 파이낸스 시세를 polling 합니다.
요약:

Yahoo Finance: 대부분의 차트 데이터, 미국/한국 주식 시세, 코인(USD) 시세
Upbit: 차트 작성 시 KRW- 코인 차트 데이터
Supabase: 게시글 내용, 예측 정확도, 과거 기록
참고: Twelve Data나 KIS(한국투자증권) 관련 코드는 주석 처리되었거나 현재 이 파일들에서는 사용되지 않고 있습니다.