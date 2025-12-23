-- Add missing columns to point_transactions table
ALTER TABLE public.point_transactions 
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('EARN', 'USE', 'ADMIN', 'REFUND'));

-- Update existing rows if any to have default values (optional but good for consistency)
UPDATE public.point_transactions 
SET reason = 'Legacy Transaction', type = 'ADMIN' 
WHERE reason IS NULL;

-- Now make them NOT NULL if you want to enforce it, but let's keep it safe first
-- ALTER TABLE public.point_transactions ALTER COLUMN reason SET NOT NULL;
-- ALTER TABLE public.point_transactions ALTER COLUMN type SET NOT NULL;

-- Re-apply permissions just in case
GRANT ALL ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;
