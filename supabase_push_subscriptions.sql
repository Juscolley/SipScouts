-- Add push_subscriptions table for Web Push notifications
-- Run this in your Supabase SQL Editor

create table if not exists public.push_subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth_key     text not null,
  created_at   timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subs_own"
  on public.push_subscriptions for all
  using (auth.uid() = user_id);

-- Allow anonymous inserts (pre-login subscription)
create policy "push_subs_insert_all"
  on public.push_subscriptions for insert
  with check (true);
