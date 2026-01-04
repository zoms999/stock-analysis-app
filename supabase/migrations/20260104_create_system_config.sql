-- Create system_config table
CREATE TABLE IF NOT EXISTS public.system_config (
    key varchar(100) NOT NULL,
    value text NOT NULL,
    description text NULL,
    is_encrypted bool DEFAULT false,
    updated_at timestamptz DEFAULT now(),
    updated_by uuid NULL,
    CONSTRAINT system_config_pkey PRIMARY KEY (key)
);

-- Enable Row Level Security
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to read config
-- Note: Adjust the condition based on your actual admin check implementation
-- Assuming a 'profiles' table with an 'is_admin' column or similar logic
CREATE POLICY "Allow admins to read config" ON public.system_config
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.user_level >= 10
    )
);

-- Create policy to allow admins to insert/update/delete config
CREATE POLICY "Allow admins to update config" ON public.system_config
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.user_level >= 10
    )
);

-- Insert initial values (MOCK values - please update with real keys in Admin UI or DB console)
INSERT INTO public.system_config (key, value, description) VALUES
('STRIPE_SECRET_KEY', 'sk_test_placeholder', 'Stripe Secret Key'),
('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder', 'Stripe Webhook Secret'),
('TWELVEDATA_API_KEY', 'demo', 'TwelveData API Key'),
('KIS_APP_KEY', 'kis_key_placeholder', 'Korea Investment App Key'),
('KIS_APP_SECRET', 'kis_secret_placeholder', 'Korea Investment App Secret'),
('KIS_IS_VIRTUAL', 'true', '모의투자 여부')
ON CONFLICT (key) DO NOTHING;
