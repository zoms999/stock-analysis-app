-- 1. Ensure Enum Exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_type') THEN
        CREATE TYPE public.tournament_type AS ENUM ('DECIMAL', 'PREDICTION');
    ELSE
        -- Attempt to add 'DECIMAL' if not present
        ALTER TYPE public.tournament_type ADD VALUE IF NOT EXISTS 'DECIMAL';
    END IF;
END $$;

-- 2. Create Tables
CREATE TABLE IF NOT EXISTS public.tournaments (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	title text NOT NULL,
	description text NULL,
	event_type public."tournament_type" NOT NULL,
	target_date timestamptz NOT NULL,
	status text DEFAULT 'OPEN'::text NULL,
	prize_pool text NULL,
	created_at timestamptz DEFAULT now() NULL,
    start_date timestamptz NULL,
    end_date timestamptz NULL,
    stock_symbol text NULL,
    prize_type text NULL,
    ranking_rules text NULL,
	CONSTRAINT tournaments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tournament_entries (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	tournament_id uuid NOT NULL,
	user_id uuid NOT NULL,
	prediction_value numeric NULL,
	prediction_json jsonb NULL,
	is_eliminated bool DEFAULT false NULL,
	re_entry_count int4 DEFAULT 0 NULL,
	max_re_entry int4 DEFAULT 1 NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT tournament_entries_pkey PRIMARY KEY (id),
	CONSTRAINT tournament_entries_tournament_id_user_id_key UNIQUE (tournament_id, user_id)
);

-- 3. Insert Sample KOSPI Tournament (Active)
INSERT INTO public.tournaments (
    title, 
    description, 
    event_type, 
    target_date, 
    start_date, 
    end_date, 
    status, 
    prize_pool, 
    stock_symbol, 
    ranking_rules
) VALUES (
    '제1회 코스피 소수점 맞추기',
    '오늘의 코스피 지수 소수점 2자리를 예측하세요! 친구에게 공유하면 최대 3개 슬롯까지 배팅 가능합니다.',
    'DECIMAL',
    (CURRENT_DATE + 1 || ' 15:30:00')::timestamptz, -- Tomorrow Market Close
    NOW(),
    (CURRENT_DATE + 1 || ' 15:00:00')::timestamptz,
    'OPEN',
    '100,000 P',
    'KOSPI',
    '1. 코스피 지수 종가의 소수점 2자리를 예측합니다.\n2. 정확히 맞춘 분들이 상금을 N/1로 가져갑니다.\n3. 친구에게 공유하면 슬롯이 추가됩니다.'
);
