-- ============================================================
-- SipScouts B2B Analytics & Viral Growth Upgrade Schema
-- Run this in your Supabase SQL Editor (100% Free):
-- https://supabase.com/dashboard/project/ygmtehcnifjqxhzdmkkt/sql/new
-- ============================================================

-- 1. VENUE CLICKS & VIRAL SHARE ATTRIBUTION TABLE
-- Logs every time a user taps Call, Instagram, Menu/Website, Save, or Share/Invite on a venue card
create table if not exists public.venue_clicks (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.users(id) on delete set null,
  venue_name          text not null,
  venue_address       text,
  venue_type          text,          -- 'cafe' | 'bar'
  action_type         text not null, -- 'call' | 'instagram' | 'website' | 'bookmark' | 'share_venue' | 'share_badge'
  searched_drink      text,
  searched_ingredient text,
  city                text,
  zip_code            text,
  latitude            double precision,
  longitude           double precision,
  device_type         text,          -- 'mobile' | 'desktop'
  clicked_at          timestamptz default now()
);

alter table public.venue_clicks enable row level security;

-- Allow anyone (logged-in or anonymous) to log venue clicks & viral shares
drop policy if exists "venue_clicks_insert_all" on public.venue_clicks;
create policy "venue_clicks_insert_all"
  on public.venue_clicks for insert
  with check (true);

-- Allow reading aggregated/raw venue clicks for the B2B Merchant Dashboard
drop policy if exists "venue_clicks_select_all" on public.venue_clicks;
create policy "venue_clicks_select_all"
  on public.venue_clicks for select
  using (true);

-- 2. UNMET CRAVING / SUPPLY GAP ANALYTICS VIEW
-- Surfaces high-demand drinks & ingredients in a City/ZIP where local venue supply (avg_results) is low
create or replace view public.unmet_demand_analytics as
select
  coalesce(nullif(city, ''), nullif(zip_code, ''), 'All Locations') as location_label,
  city,
  zip_code,
  drink,
  ingredient,
  count(*)                                                          as search_volume,
  count(distinct user_id)                                           as unique_signed_in_scouts,
  round(avg(coalesce(result_count, 0))::numeric, 1)                 as avg_results,
  min(coalesce(result_count, 0))                                    as min_results,
  max(searched_at)                                                  as last_searched_at,
  -- Opportunity Score: higher search volume + fewer existing results = higher score for local cafes/bars
  round(
    (count(*)::numeric * (16.0 / greatest(avg(coalesce(result_count, 0))::numeric + 1.0, 1.0))),
    1
  )                                                                 as opportunity_score
from public.search_events
where coalesce(drink, '') <> '' or coalesce(ingredient, '') <> ''
group by city, zip_code, drink, ingredient
order by opportunity_score desc, search_volume desc;

-- 3. VENUE LEAD & VIRAL SHARE SUMMARY VIEW
-- Shows exact customer actions (Calls, Instagram visits, Website/Menu clicks, Bookmarks, Friend Invites) per venue
create or replace view public.venue_lead_analytics as
select
  venue_name,
  max(venue_address)                                                as venue_address,
  max(venue_type)                                                   as venue_type,
  max(city)                                                         as city,
  max(zip_code)                                                     as zip_code,
  count(*)                                                          as total_interactions,
  count(*) filter (where action_type = 'call')                      as phone_calls,
  count(*) filter (where action_type = 'instagram')                 as instagram_clicks,
  count(*) filter (where action_type = 'website')                   as website_clicks,
  count(*) filter (where action_type = 'bookmark')                  as bookmark_saves,
  count(*) filter (where action_type = 'share_venue')               as viral_friend_invites,
  max(searched_drink)                                               as top_searched_drink,
  max(searched_ingredient)                                          as top_searched_ingredient,
  max(clicked_at)                                                   as last_interaction_at
from public.venue_clicks
where venue_name <> '__BADGE_SHARE__'
group by venue_name
order by total_interactions desc, last_interaction_at desc;

-- 4. SIGNED-IN USER TASTE AFFINITY VIEW
-- Connects live search behavior with user profile favorite_drinks & favorite_ingredients
create or replace view public.user_affinity_analytics as
select
   coalesce(nullif(u.zip_code, ''), nullif(se.zip_code, ''), nullif(se.city, ''), 'Global') as market_area,
  se.drink                                                          as searched_drink,
  se.ingredient                                                     as searched_ingredient,
  u.favorite_drinks                                                 as profile_favorite_drinks,
  u.favorite_ingredients                                            as profile_favorite_ingredients,
  count(*)                                                          as attributed_searches,
  max(se.searched_at)                                               as last_searched_at
from public.search_events se
join public.users u on u.id = se.user_id
group by 1, 2, 3, 4, 5
order by attributed_searches desc;
