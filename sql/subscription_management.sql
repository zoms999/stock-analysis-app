-- Subscription Management Schema Updates
-- 구독 일시정지/재개, 결제 실패 처리를 위한 컬럼 추가

-- 1. subscriptions 테이블에 추가 컬럼
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_error TEXT;

-- 2. 구독 상태 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
ON public.subscriptions(user_id, status);

-- 3. point_transactions에 metadata 컬럼 추가 (이미 있을 수 있음)
ALTER TABLE public.point_transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 4. 결제 실패 알림을 위한 뷰 (관리자용)
CREATE OR REPLACE VIEW public.payment_issues AS
SELECT 
  s.id as subscription_id,
  s.user_id,
  p.email,
  p.nickname,
  s.status,
  s.last_payment_error,
  s.current_period_end,
  pl.name as plan_name,
  pl.price as plan_price
FROM public.subscriptions s
JOIN public.profiles p ON s.user_id = p.id
LEFT JOIN public.plans pl ON s.plan_id = pl.id
WHERE s.status IN ('past_due', 'unpaid')
ORDER BY s.current_period_end ASC;

-- 5. 구독 통계 뷰 (관리자용)
CREATE OR REPLACE VIEW public.subscription_stats AS
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE cancel_at_period_end = true) as canceling_count
FROM public.subscriptions
GROUP BY status;

-- 6. RLS 정책 업데이트 (사용자가 자신의 구독만 볼 수 있도록)
-- 기존 정책이 있다면 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" 
ON public.subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- 관리자는 모든 구독 조회 가능
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
ON public.subscriptions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- 7. 환불 기록 테이블 (선택사항)
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  subscription_id UUID REFERENCES public.subscriptions(id),
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  reason TEXT,
  status VARCHAR(20) DEFAULT 'succeeded',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 환불 테이블 RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own refunds" ON public.refunds;
CREATE POLICY "Users can view own refunds"
ON public.refunds FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage refunds" ON public.refunds;
CREATE POLICY "Admins can manage refunds"
ON public.refunds FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- 권한 부여
GRANT SELECT ON public.payment_issues TO authenticated;
GRANT SELECT ON public.subscription_stats TO authenticated;
GRANT ALL ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;


