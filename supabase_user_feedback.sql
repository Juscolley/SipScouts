-- ============================================================
-- SipScouts User Feedback & Feature Wishlist Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ygmtehcnifjqxhzdmkkt/sql/new
-- ============================================================

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz default now() not null,
  craving_or_feature_wish text not null,
  user_email text,
  city_or_zip text,
  device_type text default 'mobile',
  user_id uuid references public.users(id) on delete set null
);

-- Enable Row Level Security (RLS)
alter table public.user_feedback enable row level security;

-- 1. Allow anyone (anonymous or authenticated) to submit a wish or feedback
drop policy if exists "user_feedback_insert_all" on public.user_feedback;
create policy "user_feedback_insert_all"
  on public.user_feedback for insert
  with check (true);

-- 2. Allow reading feedback for the Merchant/Creator Dashboard
drop policy if exists "user_feedback_select_all" on public.user_feedback;
create policy "user_feedback_select_all"
  on public.user_feedback for select
  using (true);

-- Indexes for performance
create index if not exists idx_user_feedback_submitted_at on public.user_feedback(submitted_at desc);
create index if not exists idx_user_feedback_city_or_zip on public.user_feedback(city_or_zip);
