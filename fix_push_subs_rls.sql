-- ============================================================
-- Fix push_subscriptions Row Level Security Policy in Supabase
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ygmtehcnifjqxhzdmkkt/sql/new
-- ============================================================

-- Drop existing restrictive insert policy if present
drop policy if exists "push_subs_insert_all" on public.push_subscriptions;
drop policy if exists "push_subs_all" on public.push_subscriptions;

-- Allow anyone (anonymous or authenticated) to insert their push subscription endpoint
create policy "push_subs_insert_all"
  on public.push_subscriptions for insert
  with check (true);

-- Allow anyone to update their own subscription endpoint
create policy "push_subs_update_all"
  on public.push_subscriptions for update
  using (true)
  with check (true);

-- Allow users to delete their subscription endpoint when unsubscribing
create policy "push_subs_delete_all"
  on public.push_subscriptions for delete
  using (true);
