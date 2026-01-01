# 📈 Stock Chart Analysis Platform

업비트 스타일의 차트 분석 플랫폼입니다. 실시간 주식/암호화폐 차트를 분석하고 예측 포인트를 표시할 수 있습니다.

## ✨ 주요 기능

### 📊 차트 분석

- **업비트 스타일 차트**: 빨간색(상승), 파란색(하락) 캔들스틱
- **다양한 시간대**: 1분봉, 60분봉, 일봉, 주봉, 월봉, 연봉
- **기술적 지표**: 5일/20일 이동평균선(MA)
- **볼륨 차트**: 하단에 거래량 히스토그램 표시
- **실시간 가격 정보**: 현재가, 등락률 표시

### 🎯 예측 기능

- **클릭으로 예측 포인트 추가**: 차트를 클릭하여 예측 가격 지점 표시
- **예측 라인 연결**: 파란색 점선으로 예측 경로 시각화
- **정확한 마우스 포인터 정렬**: 클릭한 위치의 정확한 가격 값 사용

### 💾 분석 저장

- **차트 이미지 자동 캡처**: 분석 시점의 차트 자동 저장
- **분석 내용 작성**: 텍스트 에디터로 상세 분석 작성
- **Supabase 저장**: 차트 이미지와 분석 내용 클라우드 저장

## 🚀 시작하기

### 필수 요구사항

- Node.js 18+
- npm/yarn/pnpm

### 설치

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수를 설정하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Twelve Data (server-only)
TWELVEDATA_API_KEY=your_twelve_data_api_key
```

> 참고: `.env.local`을 수정/추가한 뒤에는 **개발 서버를 재시작**해야 반영됩니다.
> 예시 파일은 `ENV.example`을 참고하세요.

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── analyze/          # 차트 분석 페이지
│   ├── api/              # API 라우트
│   └── ...
├── components/
│   ├── analyze/          # 차트 분석 컴포넌트
│   │   └── ChartAnalyzer.tsx  # 메인 차트 컴포넌트
│   ├── chart/            # 차트 관련 컴포넌트
│   └── ui/               # UI 컴포넌트
└── lib/
    ├── api/              # API 클라이언트
    └── supabase/         # Supabase 클라이언트
```

## 🛠️ 기술 스택

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Charts**: Lightweight Charts 5
- **Database**: Supabase
- **Data Source**: Twelve Data API
- **Language**: TypeScript

## 📊 차트 사용법

1. **종목 검색**: 상단 검색창에 종목 심볼 입력 (예: BTC-USD, AAPL, TSLA)
2. **시간대 선택**: 년/월/주/일/시/분 탭에서 원하는 시간대 선택
3. **예측 포인트 추가**: 차트를 클릭하여 예측 가격 지점 표시
4. **분석 작성**: 하단 텍스트 에디터에 분석 내용 작성
5. **저장**: "분석 저장" 버튼 클릭

## 🎨 차트 스타일

- **상승 캔들**: #D24F45 (빨간색)
- **하락 캔들**: #1261C4 (파란색)
- **MA5**: #FF6B6B (연한 빨간색)
- **MA20**: #4ECDC4 (청록색)
- **예측 라인**: #2962FF (파란색 점선)

## 📝 라이선스

MIT License

## 🤝 기여

이슈와 PR은 언제나 환영합니다!
