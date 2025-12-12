-- 1. Profiles Table Creation
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY, -- Supabase Auth 연결
  email TEXT NOT NULL,
  nickname TEXT UNIQUE,
  avatar_url TEXT,
  
  -- 등급 및 권한
  user_level INT DEFAULT 1 CHECK (user_level BETWEEN 1 AND 10), -- 1~10등급
  is_partner BOOLEAN DEFAULT FALSE, -- 파트너 여부
  is_admin BOOLEAN DEFAULT FALSE,   -- 관리자 여부 (★추가됨)
  admin_memo TEXT,                  -- 관리자용 유저 메모 (★추가됨)
  
  -- 마케팅/추천인
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  
  -- 자산 (포인트)
  point_balance INT DEFAULT 0,
  
  -- 설정
  language_code VARCHAR(10) DEFAULT 'ko',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Automatic Profile Creation Trigger
-- This function will be called when a new user is created in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, avatar_url)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'nickname', 'User_' || substring(new.id::text from 1 for 8)),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function after insert on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Row Level Security (RLS) Setup
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Allow public read access to some profile info (e.g. nickname, avatar) if needed for community features
-- CREATE POLICY "Public profiles are viewable by everyone" 
--   ON public.profiles 
--   FOR SELECT 
--   USING (true);
