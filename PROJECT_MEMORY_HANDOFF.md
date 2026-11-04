# SipScouts — Master Project Memory & Handoff Guide

> **How to use this file in any new Antigravity conversation:**
> Simply tell the assistant:
> *"Read `/Users/justincolley/New AI Projects/SipScout App Idea/PROJECT_MEMORY_HANDOFF.md` and `/Users/justincolley/New AI Projects/SipScout App Idea/SIPSCOUTS_VIRAL_GROWTH_STRATEGY.md` to pick up where we left off."*

---

## 1. Live Production Infrastructure & Credentials Reference
- **Project Directory:** `/Users/justincolley/New AI Projects/SipScout App Idea`
- **Live Website (Vercel Next.js 16 PWA):** `https://sipscouts.com` and `https://www.sipscouts.com` (`https://sip-scouts.vercel.app`)
- **Live Backend API (Render FastAPI Python):** `https://sipscouts.onrender.com`
- **GitHub Repository:** `https://github.com/Juscolley/SipScouts.git` (`main` branch)
- **Supabase Database & Auth:** `https://ygmtehcnifjqxhzdmkkt.supabase.co`
- **Custom Domain DNS & Email:** Bluehost DNS + Resend Custom SMTP (`smtp.resend.com`, `From: SipScouts <hello@sipscouts.com>`) wired into Supabase Magic Link Auth.
- **Creator / Admin Email (Sole B2B Analytics Access):** `juscolley0603@gmail.com`
- **Official Instagram Page:** `@SipScoutsApp` (`https://www.instagram.com/sipscoutsapp/`)
- **Previous Conversation ID (Full Transcript Archive):** `5cd8beef-c4c6-407d-9961-f2788b3f93a7`

---

## 2. What Is Already Built, Debugged & Live (`commit e0141b8`)
1. **Official Brand Logo (#4 Smoothed V-Edge Cup-Pin-Martini) & Mascot:**
   - Deployed across the sticky header bar, hero centerpiece badge, login card, PWA install icons (`192x192`, `512x512`, `apple-touch-icon.png`, `favicon.ico`), and OpenGraph social cards.
2. **Global 55-Mile Local Search + Two-Tier Results (`Exact Match` vs. `Potential Match`):**
   - `app/services/google_scraper.py`, `app/services/scraper_orchestrator.py`, and `frontend/src/app/discover/page.tsx` enforce a strict 55-mile (`88.6 km`) radius globally (preventing out-of-state results) and split results into **`🎯 Closest Exact Matches`** and **`✨ Potential Local Matches`**.
   - ** Google Maps Platform:** Set to Pay-As-You-Go (10,000 free calls/month) with a $1 billing alert configured by Justin. Visual maps use 100% free Leaflet + OpenStreetMap (`VenueMap.tsx`).
3. **Speed & 24/7 Keep-Warm Optimizations:**
   - Instant `/api/ping` wakeup on `/discover` page open + 10-minute external keep-warm heartbeat in `app/scheduler.py` (`keep_render_warm_job`).
   - Single-Flight Thread Lock + spatial bounding-box (`[bbox:...]`) + `User-Agent: SipScouts/1.0` in `app/services/discovery.py` so dense metros like Los Angeles respond in `~0.86s–1.14s`.
4. **Passwordless Magic Link Auth + Returning Member Hub:**
   - Dedicated **`🔑 Sign In`** vs. **`✨ Join Free`** tabs on `/login`.
   - Returning Member Hub on `/profile` (`Welcome back, [Name]! 👋`) with **1-Tap Quick-Search Favorites** (clicking any saved Drink or Ingredient launches that search in their Home ZIP on `/discover`), `✏️ Edit Profile` toggle, and `🚪 Sign Out`.
   - Personalized 1-Tap Favorites bar & auto-filled Home ZIP right under the search bar on `/discover` for signed-in users.
5. **Viral Share Badge Loop + `@SipScoutsApp` Instagram Studio + Creator-Only B2B Analytics (`/merchant`):**
   - Dynamic OpenGraph badge generator (`/og/badge`, `runtime = 'nodejs'`) + `/og/instagram` (9:16 Story & 1:1 Feed PNG generator) + `/api/ig-autopost` JSON automation feed + `/share` recipient landing page + `📲 Share Badge Card` on `/profile`.
   - Uncrowded 2-button Venue Card Action Footer (`🥂 Invite Friend` + `📸 IG Story Card`) + 1-Tap Trending Cravings Bar + `🔗 Share This Search Map` on `/discover`.
   - Creator-only `📸 @SipScoutsApp Instagram Auto-Content & Growth Studio` inside `/merchant` (locked to `juscolley0603@gmail.com`).
   - 3 High-Value Supabase B2B Analytics views live (`public.venue_clicks`, `public.unmet_demand_analytics`, `public.venue_lead_analytics`, `public.user_affinity_analytics`).

---

## 3. Current Focus & Next Agenda (For New Conversation)
1. **Rapid User Growth Strategy (Using the Current Debugged Release):**
   - Maximize organic user acquisition and search volume with the current release so the Supabase analytics tables (`search_events`, `venue_clicks`, `unmet_demand_analytics`, `venue_lead_analytics`, `user_affinity_analytics`) fill up with high-value B2B market intelligence.
2. **Integrating & Automating the New `@SipScoutsApp` Instagram Page:**
   - Wire `@SipScoutsApp` into the SipScouts app and viral badge/discovery loop.
   - Design and implement **free/automated workflows** to populate and grow `@SipScoutsApp` (e.g., auto-generating daily/weekly "Hidden Gem Sip Spotlights" or "Top Trending Cravings in [City]" carousel/story graphics from our scraper & search data, linking `@SipScoutsApp` in the app header/footer/share cards, and automating café `@handle` mentions/tags).
