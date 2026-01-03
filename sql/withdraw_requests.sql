-- Create table for withdrawal requests
create table if not exists withdraw_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  amount integer not null check (amount > 0),
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  status text not null check (status in ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')) default 'PENDING',
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

-- RLS policies
alter table withdraw_requests enable row level security;

-- Users can view their own requests
create policy "Users can view their own withdrawal requests"
  on withdraw_requests for select
  using (auth.uid() = user_id);

-- Users can create their own requests
create policy "Users can create withdrawal requests"
  on withdraw_requests for insert
  with check (auth.uid() = user_id);

-- Admins can view all requests
create policy "Admins can view all withdrawal requests"
  on withdraw_requests for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and (is_admin = true or user_level >= 99)
    )
  );

-- Admins can update requests (approve/reject)
create policy "Admins can update withdrawal requests"
  on withdraw_requests for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and (is_admin = true or user_level >= 99)
    )
  );
