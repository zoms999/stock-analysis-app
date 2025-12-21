# Webhook 로컬 테스트 가이드

## 문제
로컬 개발 환경(`localhost:3000`)에서는 Stripe Webhook이 작동하지 않습니다.
Stripe는 공개 URL로만 이벤트를 보낼 수 있기 때문입니다.

## 해결 방법

### 방법 1: Stripe CLI 사용 (권장)

1. **Stripe CLI 설치**
   - Windows: https://github.com/stripe/stripe-cli/releases/latest
   - `stripe_X.X.X_windows_x86_64.zip` 다운로드 및 압축 해제

2. **Stripe 로그인**
   ```bash
   stripe login
   ```

3. **Webhook 포워딩 시작**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Webhook Secret 복사**
   - 터미널에 표시되는 `whsec_xxxxx` 복사
   - `.env.local`의 `STRIPE_WEBHOOK_SECRET`에 붙여넣기

5. **테스트**
   - 다른 터미널에서 `npm run dev` 실행
   - 구독 테스트

### 방법 2: 수동 구독 생성 (임시)

Supabase SQL Editor에서 실행:

```sql
-- 1. 현재 사용자 ID 확인
SELECT id, email FROM profiles ORDER BY created_at DESC LIMIT 5;

-- 2. 구독 생성 (user_id를 위에서 확인한 값으로 변경)
INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
VALUES (
  'YOUR_USER_ID_HERE',  -- 위에서 확인한 ID
  2,  -- 플랜 ID (2=Light, 3=Standard, 4=Premium, 5=VIP)
  'active',
  NOW(),
  NOW() + INTERVAL '1 month'
);
```

### 방법 3: 배포 후 테스트

1. Vercel/Netlify 등에 배포
2. Stripe Dashboard → Webhooks에서 엔드포인트 추가
   - URL: `https://your-domain.com/api/stripe/webhook`
   - 이벤트: `checkout.session.completed`
3. Webhook Secret을 프로덕션 환경 변수에 추가

## 참고

- 로컬 개발 시 Stripe CLI 사용 권장
- 프로덕션에서는 Stripe Dashboard에서 Webhook 설정 필수

PS G:\dev_chart> stripe listen --forward-to localhost:3000/api/stripe/webhook
> Ready! You are using Stripe API Version [2025-12-15.clover]. Your webhook signing secret is whsec_16b88e7806501d857f179432b3f616ccc0674f3959c813a7e612a80c0597b5bc
