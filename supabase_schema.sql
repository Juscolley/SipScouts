-- ============================================================
-- SipScouts Database Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ygmtehcnifjqxhzdmkkt/sql/new
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- Stores B2C user profiles and preferences
-- ============================================================
create table if not exists public.users (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique not null,
  name          text,
  sex           text,
  dob           date,
  zip_code      text,
  mobile        text,
  favorite_drinks     text[]   default '{}',
  favorite_ingredients text[]  default '{}',
  favorite_locations  text[]   default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- SEARCH EVENTS TABLE
-- Anonymised log of every discovery search
-- ============================================================
create table if not exists public.search_events (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.users(id) on delete set null,
  drink         text,
  ingredient    text,
  city          text,
  zip_code      text,
  latitude      double precision,
  longitude     double precision,
  result_count  int default 0,
  searched_at   timestamptz default now()
);

-- ============================================================
-- BOOKMARKS TABLE
-- User saved / favourite venues
-- ============================================================
create table if not exists public.bookmarks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.users(id) on delete cascade,
  venue_name  text not null,
  venue_address text,
  venue_type  text,  -- 'cafe' | 'bar'
  latitude    double precision,
  longitude   double precision,
  notes       text,
  created_at  timestamptz default now()
);

-- ============================================================
-- MERCHANT ANALYTICS VIEW
-- Aggregated, anonymised data for B2B dashboards
-- No PII is exposed in this view
-- ============================================================
create or replace view public.merchant_analytics as
select
  date_trunc('hour', searched_at)  as hour_bucket,
  city,
  zip_code,
  drink,
  ingredient,
  count(*)                          as search_volume,
  avg(result_count)                 as avg_results
from public.search_events
group by 1, 2, 3, 4, 5;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only read/write their own data
-- ============================================================
alter table public.users         enable row level security;
alter table public.search_events enable row level security;
alter table public.bookmarks     enable row level security;

-- Users policy: only the owner can see their own row
create policy "users_own_row"
  on public.users for all
  using (auth.uid() = id);

-- Search events: users see only their own searches
create policy "search_events_own"
  on public.search_events for all
  using (auth.uid() = user_id);

-- Bookmarks: users see only their own bookmarks
create policy "bookmarks_own"
  on public.bookmarks for all
  using (auth.uid() = user_id);

-- Allow anonymous inserts to search_events (for non-logged-in discovery)
create policy "search_events_anon_insert"
  on public.search_events for insert
  with check (true);
