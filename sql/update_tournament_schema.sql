-- Ensure tournament_type enum has DECIMAL
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_type') THEN
        CREATE TYPE public.tournament_type AS ENUM ('DECIMAL', 'PREDICTION');
    ELSE
        -- Add value if not exists (cannot be done easily in one command without error if exists, 
        -- so we catch error or use pg_enum checks. 
        -- Simpler: Just try alter and ignore error if it says "already exists" is not easy in pure sql block without exception handling)
        -- We will leave it as is, assuming user might have created it. 
        -- Or we can try to add it blindly in a separate block.
    END IF;
END $$;

-- Hack to add enum value safely
DO $$
BEGIN
    ALTER TYPE public.tournament_type ADD VALUE 'DECIMAL';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- Create tournaments table if not exists
CREATE TABLE IF NOT EXISTS public.tournaments (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	title text NOT NULL,
	description text NULL,
	event_type public."tournament_type" NOT NULL,
	target_date timestamptz NOT NULL,
	status text DEFAULT 'OPEN'::text NULL, -- Simple text or enum
	prize_pool text NULL,
	created_at timestamptz DEFAULT now() NULL,
    
    -- New columns
    start_date timestamptz NULL,
    end_date timestamptz NULL,
    stock_symbol text NULL,
    prize_type text NULL, -- POINT, VOUCHER
    ranking_rules text NULL,

	CONSTRAINT tournaments_pkey PRIMARY KEY (id)
);


-- Create tournament_entries table if not exists
CREATE TABLE IF NOT EXISTS public.tournament_entries (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	tournament_id uuid NOT NULL,
	user_id uuid NOT NULL,
	prediction_value numeric NULL,
	prediction_json jsonb NULL, -- { slots: [] }
	is_eliminated bool DEFAULT false NULL,
	re_entry_count int4 DEFAULT 0 NULL,
	max_re_entry int4 DEFAULT 1 NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT tournament_entries_pkey PRIMARY KEY (id),
	CONSTRAINT tournament_entries_tournament_id_user_id_key UNIQUE (tournament_id, user_id)
);

-- Add foreign keys if not exists (checked by constraint name)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_tournament_id_fkey') THEN
        ALTER TABLE public.tournament_entries ADD CONSTRAINT tournament_entries_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);
    END IF;
END $$;
