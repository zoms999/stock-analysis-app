-- 댓글 테이블 + RLS 정책
-- 실행 위치: Supabase SQL Editor

-- 1) table
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_post_comments_post_id_created_at
  on public.post_comments (post_id, created_at);

create index if not exists idx_post_comments_user_id_created_at
  on public.post_comments (user_id, created_at);

-- 2) updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_post_comments_set_updated_at on public.post_comments;
create trigger trg_post_comments_set_updated_at
before update on public.post_comments
for each row execute function public.set_updated_at();

-- 3) RLS
alter table public.post_comments enable row level security;

-- 누구나 댓글을 읽을 수 있도록 (게시글 공개 전제)
drop policy if exists "post_comments_select_public" on public.post_comments;
create policy "post_comments_select_public"
  on public.post_comments
  for select
  using (true);

-- 로그인한 사용자는 자신의 user_id로만 insert
drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own"
  on public.post_comments
  for insert
  with check (auth.uid() = user_id);

-- 수정/삭제는 본인만
drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own"
  on public.post_comments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own"
  on public.post_comments
  for delete
  using (auth.uid() = user_id);









