-- Partner referral settlement (자동 적립) + 중복 방지
-- 1) partner_settlements에 stripe 참조키 컬럼 추가 (idempotency)
ALTER TABLE public.partner_settlements
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- 2) 중복 적립 방지용 unique index
-- 같은 subscription/session에 대해 settlement가 중복 생성되지 않도록 막습니다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'partner_settlements_unique_stripe_ref'
  ) THEN
    CREATE UNIQUE INDEX partner_settlements_unique_stripe_ref
      ON public.partner_settlements (stripe_subscription_id)
      WHERE stripe_subscription_id IS NOT NULL;
  END IF;
END $$;

-- 3) 결제 발생 시 추천인 정산 내역 생성 함수
-- - payer_id: 결제한 유저
-- - payment_amount: 결제금액(원/달러 등 currency 단위는 호출부 정책에 따름)
-- - stripe_subscription_id / stripe_checkout_session_id: 중복 방지용 참조키
CREATE OR REPLACE FUNCTION public.create_referral_settlement(
  payer_id uuid,
  payment_amount numeric,
  stripe_subscription_id text DEFAULT NULL,
  stripe_checkout_session_id text DEFAULT NULL,
  commission_rate numeric DEFAULT 10.0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  partner_uuid uuid;
  settle_amt numeric;
  partner_ok boolean;
BEGIN
  -- 0) 결제금액 sanity check
  IF payment_amount IS NULL OR payment_amount <= 0 THEN
    RETURN;
  END IF;

  -- 1) 결제자의 추천인(파트너) 찾기
  SELECT referred_by INTO partner_uuid
  FROM public.profiles
  WHERE id = payer_id;

  IF partner_uuid IS NULL THEN
    RETURN;
  END IF;

  -- 2) 추천인이 실제 파트너인지 확인
  SELECT is_partner INTO partner_ok
  FROM public.profiles
  WHERE id = partner_uuid;

  IF partner_ok IS DISTINCT FROM TRUE THEN
    RETURN;
  END IF;

  -- 3) 정산금 계산 (정책: 소수점은 버림)
  settle_amt := floor(payment_amount * (commission_rate / 100.0));

  IF settle_amt <= 0 THEN
    RETURN;
  END IF;

  -- 4) Insert (중복 방지는 unique index로 처리)
  INSERT INTO public.partner_settlements (
    partner_id,
    source_user_id,
    payment_amount,
    commission_rate,
    settlement_amount,
    is_paid,
    stripe_subscription_id,
    stripe_checkout_session_id
  ) VALUES (
    partner_uuid,
    payer_id,
    payment_amount,
    commission_rate,
    settle_amt,
    false,
    stripe_subscription_id,
    stripe_checkout_session_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;




