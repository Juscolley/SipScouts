-- ============================================================
-- SipScouts: Clear Beta Testing Data
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ygmtehcnifjqxhzdmkkt/sql/new
-- ============================================================

-- 1. Reset all anonymous and beta test search events
truncate table public.search_events cascade;

-- 2. Reset all venue click and lead analytics events
truncate table public.venue_clicks cascade;

-- 3. Reset all user feedback submissions (if any)
truncate table public.user_feedback cascade;

-- Verification query (all should return 0)
select 
  (select count(*) from public.search_events) as search_count,
  (select count(*) from public.venue_clicks) as click_count,
  (select count(*) from public.user_feedback) as feedback_count;
