# Nesty Dashboard — Product Requirements Document

## Internal Analytics & Business Intelligence Platform

**Version 1.0 | March 2026**
**Author:** Jack (Nesty Founder)
**Status:** Draft → Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Goals](#2-problem-statement--goals)
3. [Deep Research: What Matters & Why](#3-deep-research-what-matters--why)
4. [User Personas & Access Control](#4-user-personas--access-control)
5. [Dashboard Architecture](#5-dashboard-architecture)
6. [Metric Definitions & Data Sources](#6-metric-definitions--data-sources)
7. [Screen-by-Screen Specification](#7-screen-by-screen-specification)
8. [Supabase Backend: Views, RPCs & Schema](#8-supabase-backend-views-rpcs--schema)
9. [Google Analytics 4 Integration](#9-google-analytics-4-integration)
10. [Tech Stack & Infrastructure](#10-tech-stack--infrastructure)
11. [Authentication & Security](#11-authentication--security)
12. [Deployment & Hosting](#12-deployment--hosting)
13. [Implementation Phases](#13-implementation-phases)
14. [SQL Queries Reference](#14-sql-queries-reference)
15. [Open Questions & Future Considerations](#15-open-questions--future-considerations)

---

## 1. Executive Summary

Nesty is a Hebrew-first baby registry platform serving Israeli expecting parents. The product has three core features: a baby checklist, a shareable gift registry, and gift tracking. Users sign up via Google OAuth, build their registry from any Israeli e-commerce store (via Chrome extension or URL paste), share it with family/friends, and track received gifts.

**The problem:** Beyond sign-up counts, the Nesty team is blind to what users actually do inside the product and where the monetization opportunities lie.

**This PRD defines** an internal analytics dashboard that connects directly to Nesty's Supabase production database and Google Analytics 4, providing real-time visibility into user engagement, the conversion funnel, registry economics, store/category distribution, and affiliate monetization potential.

**The dashboard will live at** `dashboard.nestyil.com` (or similar subdomain), be accessible only to approved team members via Google sign-in with an email allowlist, and serve a small team of 2–5 people.

---

## 2. Problem Statement & Goals

### 2.1 The Blind Spots

Today, Nesty tracks GTM events (13 custom events defined) and has Meta Pixel integration, but there is no unified internal view that answers:

- **Product questions:** Where do users drop off? Which features are actually used? How healthy are registries?
- **Monetization questions:** Which stores do users buy from? What categories are most popular? How much is spent per registry? Where should affiliate partnerships focus?
- **Growth questions:** How fast is the user base growing? What's the viral coefficient (registry shares → new signups)? What's the retention curve?

### 2.2 Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Understand the full user funnel from signup to gift received | Can see exact drop-off % at each funnel stage |
| G2 | Identify which stores & categories to prioritize for affiliate deals | Top 10 stores by item count and total value visible |
| G3 | Quantify registry economics (avg. value, completion rate, gift rate) | Summary KPIs on dashboard home |
| G4 | Track Chrome extension adoption & impact | Extension users vs. non-extension users compared |
| G5 | Enable data-driven product decisions for a small team | Dashboard loads in <3 seconds, updates in real-time |

### 2.3 Non-Goals (v1)

- Public-facing analytics or user-facing dashboards
- Automated alerting/notifications (future)
- A/B test management
- Direct database write operations from dashboard
- Mobile-optimized layout (desktop-first for internal use)

---

## 3. Deep Research: What Matters & Why

This section captures the strategic research that informed the dashboard design. It explains *why* each metric matters for Nesty specifically, connecting data points to business decisions.

### 3.1 The Nesty North Star Metric

For a baby registry platform, the **North Star Metric (NSM)** is:

> **Number of registries that received at least one gift in the last 30 days**

This single number captures the full value chain: a user signed up, completed onboarding, added items, shared their registry, and a gift giver actually purchased something. If this number grows, the product is working.

**Why not "active users"?** Active users measures engagement, but a user who logs in and browses the checklist without ever sharing their registry isn't generating the core value (receiving gifts) or the core monetization opportunity (affiliate purchases through stores).

### 3.2 The Funnel: Where Users Drop Off (and What to Do About It)

Based on Nesty's data model, the user journey has 7 distinct stages. Each stage represents a point where users can drop off, and each drop-off suggests a different product intervention:

```
Stage 1: Signed Up
    ↓ (Drop-off → Onboarding friction)
Stage 2: Completed Onboarding
    ↓ (Drop-off → Don't see value yet)
Stage 3: Added First Item to Registry
    ↓ (Drop-off → Extension not installed / manual is too hard)
Stage 4: Added 5+ Items
    ↓ (Drop-off → Registry feels incomplete / overwhelmed)
Stage 5: Shared Registry Link
    ↓ (Drop-off → Not ready / doesn't know how to share)
Stage 6: Registry Viewed by Gift Giver
    ↓ (Drop-off → Gift givers don't convert)
Stage 7: Received a Gift
    ↓ (Drop-off → Purchase confirmation friction)
```

**Why 7 stages and not 3?** The difference between "added 1 item" and "added 5+ items" is critical. A registry with 1 item is unlikely to be shared. The 5-item threshold (configurable) represents a "complete enough" registry that users feel confident sharing. Similarly, "shared" vs. "viewed" separates the user's action from the outcome—a shared link that nobody clicks suggests the sharing mechanism needs improvement, not the registry itself.

**Dashboard implication:** The funnel view should show both absolute numbers and conversion rates between each stage, with the ability to filter by time period and cohort.

### 3.3 Registry Economics: The Numbers That Sell Affiliate Deals

When approaching a store like Shilav or Baby Land for an affiliate partnership, the conversation needs concrete numbers:

| Metric | What It Tells a Store Partner | How Nesty Calculates It |
|--------|-------------------------------|------------------------|
| **Average Registry Value** | Total purchase volume potential | `SUM(items.price * items.quantity) / COUNT(DISTINCT registries)` |
| **Average Items per Registry** | Breadth of purchasing intent | `COUNT(items) / COUNT(DISTINCT registries)` |
| **Registry Completion Rate** | How likely items actually get bought | `items WHERE quantity_received >= quantity / total items` |
| **Average Gift Value** | Typical transaction size | `AVG(items.price) WHERE quantity_received > 0` |
| **Items from Store X** | Direct relevance to the store | `COUNT(items) WHERE store_name = 'Store X'` |
| **Total Value from Store X** | Revenue potential for the store | `SUM(price * quantity) WHERE store_name = 'Store X'` |
| **Gift Giver Conversion** | How often viewers buy | `purchases / registry_views` |

**Why "average registry value" matters most for affiliates:** If Nesty can show that the average registry is worth ₪8,000 and that 60% of items get purchased, a store doing 15% of those items can calculate their expected revenue per Nesty user. That's a compelling affiliate pitch.

### 3.4 Store Distribution: Finding the Right Partners

Nesty's `items.store_name` and `items.original_url` fields reveal which stores users prefer. This data directly answers: "Who should we approach for affiliate deals first?"

**Analysis approach:**

1. **By item count** — Which stores appear most frequently? (Shows user preference)
2. **By total value** — Which stores have the highest total ₪ value? (Shows revenue potential)
3. **By category** — Which stores dominate which categories? (Enables category-specific deals)
4. **By purchase rate** — Which stores' items actually get bought? (Shows gift-giver trust in the store)

**Store name normalization challenge:** Users add items via the Chrome extension, which extracts `store_name` from the page. The same store might appear as "שילב", "Shilav", "shilav.co.il", etc. The dashboard should normalize store names (documented in Section 8) and show the domain as the canonical identifier.

**Dashboard implication:** A dedicated "Stores" section with a ranked table (sortable by count, value, purchase rate) and a bar chart showing the top 10.

### 3.5 Category Distribution: What Do Israeli Parents Actually Need?

Nesty has 10 item categories (strollers, car_safety, furniture, safety, feeding, nursing, bath, clothing, bedding, toys) and 5 checklist categories (nursery, travel, clothing, bath, feeding).

**Why this matters for monetization:**
- If 35% of registry value is in "strollers" and "car_safety," those categories are the highest-value affiliate targets
- If "feeding" has the most items but lowest average price, it's high-volume but low-value (better for coupon partnerships than affiliate commissions)
- If "toys" items rarely get purchased, that category might not be worth pursuing for partnerships

**Dashboard implication:** A pie chart showing category distribution by item count AND by total value, plus a table showing purchase rate per category. The checklist category data (from `checklist_preferences`) should be shown separately to compare "what parents think they need" vs. "what they actually add to the registry."

### 3.6 Chrome Extension: The Growth Engine

The Chrome extension is Nesty's key differentiator—it makes adding items frictionless. Understanding extension adoption is critical because:

- **Extension users likely add more items** → larger registries → more gifts → more affiliate revenue
- **Extension users come from specific stores** → knowing which stores trigger extension usage helps prioritize support
- **Extension detection** is already built (`data-nesty-extension-installed` attribute) → the data is available

**Key extension metrics:**
- Extension install rate (users with extension / total users)
- Items added via extension vs. manual/paste
- Average registry size: extension users vs. non-extension users
- Store distribution from extension-added items
- Extension usage over time (are more users adopting it?)

**Dashboard implication:** A dedicated extension section showing adoption metrics and the "extension uplift" (how much larger are extension-user registries).

### 3.7 Time-Based Insights: The Pregnancy Timeline

Nesty users have a unique lifecycle: they start during pregnancy (typically weeks 20–30) and the registry is most active until the due date. After birth, activity drops sharply.

**This means:**
- User engagement should be measured relative to due date, not signup date
- "Weeks until due date" is a more meaningful x-axis than "days since signup"
- Users who signed up 2 weeks before their due date have very different behavior than those who signed up 4 months before

**Data available:** `profiles.due_date` gives exact due date. Combined with `items.created_at` and `purchases.created_at`, we can build a pregnancy-timeline view of engagement.

**Dashboard implication:** An optional "Pregnancy Timeline" view showing aggregated behavior by "weeks before due date" — when do users add the most items? When do most gifts arrive? This helps Nesty time email campaigns and feature launches.

### 3.8 Gift Giver Behavior: The Other Side of the Marketplace

Nesty is a two-sided platform: registry owners and gift givers. Gift giver behavior directly impacts monetization:

- **Store selection at purchase time** — The `purchases` table doesn't have a `store_name` field directly, but it's linked to `items.store_name`. This tells us which stores receive actual purchases.
- **Gift message usage** — How many gift givers write messages? (Engagement indicator for the gift giver experience)
- **Surprise gifts** — What % of gifts are marked as "surprise"? (Feature adoption metric)
- **Confirmation rate** — What % of "pending" purchases get confirmed? (Trust/friction indicator)
- **Time to confirm** — How long between purchase creation and confirmation? (If long, email reminders might help)

**Dashboard implication:** A "Gift Giver Insights" section showing confirmation funnel, popular gift categories, and average time-to-confirm.

### 3.9 Virality & Growth: The Sharing Multiplier

Nesty's growth depends on the viral loop: a user creates a registry → shares it → friends/family view it → some of those people might sign up for their own registry later.

**Trackable via GTM events:**
- `registry_shared` with `share_method` (whatsapp, email, link_copied, qr_code)
- `registry_viewed` with `referral_source`

**Key metrics:**
- Shares per registry (how actively do users share?)
- Views per share (how effective is each share?)
- Share method distribution (WhatsApp dominates in Israel)
- Viral coefficient (new signups from shared registry views)

**Dashboard implication:** A "Growth" section showing sharing activity and the viral loop metrics. Even without direct attribution, showing "registries shared this week" next to "new signups this week" reveals correlation.

---

## 4. User Personas & Access Control

### 4.1 Dashboard Users

| Role | Person | Needs |
|------|--------|-------|
| **Founder/CEO** | Jack | Full access to all metrics. Needs quick overview of growth, funnel health, and monetization potential for partner meetings. |
| **Product Lead** | TBD | Funnel analysis, feature adoption, engagement metrics. Needs to understand what to build next. |
| **Growth/Marketing** | TBD | User acquisition, sharing metrics, cohort retention. Needs to optimize campaigns. |
| **Business Development** | TBD | Store breakdown, category economics, registry value. Needs data for affiliate negotiations. |

### 4.2 Access Control

- **Authentication:** Google Sign-In via Supabase Auth
- **Authorization:** Email allowlist stored in `dashboard_access` table
- **Separation from main app:** Uses a separate Supabase Auth configuration (different `auth.users` table context) OR a dedicated `dashboard_access` table checked after login
- **No self-signup:** New users must be added to the allowlist by an existing admin

---

## 5. Dashboard Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        dashboard.nestyil.com                            │
│                    React + Vite + shadcn/ui + Recharts                  │
│                     TanStack Query for data fetching                    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                ┌────────────┴────────────────┐
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│     Supabase (Primary)    │   │   Google Analytics 4     │
│                           │   │   (Secondary)            │
│ • Direct table queries    │   │                          │
│ • Materialized views      │   │ • GA4 Data API v1        │
│ • RPC functions           │   │ • Sessions, pageviews    │
│ • Real-time subscriptions │   │ • UTM attribution        │
│                           │   │ • Event funnels          │
│ Tables:                   │   │                          │
│ • profiles                │   │ GTM Container:           │
│ • registries              │   │ GTM-KGM8H82F            │
│ • items                   │   │                          │
│ • purchases               │   │ Custom Events:           │
│ • checklist_preferences   │   │ • registry_created       │
│ • contributions           │   │ • registry_shared        │
│ • price_alerts            │   │ • item_added             │
│                           │   │ • gift_purchased         │
│ Dashboard-specific:       │   │ • onboarding_step        │
│ • dashboard_access        │   │ • + 8 more               │
│ • mv_daily_metrics (MV)   │   │                          │
│ • mv_store_breakdown (MV) │   │                          │
│ • mv_funnel_snapshot (MV) │   │                          │
└───────────────────────────┘   └──────────────────────────┘
```

### 5.2 Data Flow

```
Production DB (Supabase)
    │
    ├── Materialized Views (refreshed every 5 min)
    │   ├── mv_daily_metrics      → KPI cards, trend charts
    │   ├── mv_store_breakdown    → Store ranking table, pie chart
    │   ├── mv_category_breakdown → Category pie chart, table
    │   └── mv_funnel_snapshot    → Funnel visualization
    │
    ├── RPC Functions (real-time, on-demand)
    │   ├── get_dashboard_overview()    → Top KPI numbers
    │   ├── get_funnel_data(period)     → Funnel with conversion rates
    │   ├── get_registry_economics()    → Avg value, completion, gift rate
    │   ├── get_store_ranking(limit)    → Top stores by count & value
    │   ├── get_category_distribution() → Items & value by category
    │   ├── get_extension_metrics()     → Extension adoption & impact
    │   └── get_gift_giver_insights()   → Purchase confirmation funnel
    │
    └── Direct Queries (lightweight, real-time)
        ├── Total user count
        ├── Recent signups
        └── Active registries count

GA4 API (server-side, cached)
    │
    ├── Sessions & pageviews (daily)
    ├── User acquisition channels
    ├── Custom event counts
    └── Registry view counts (from GA events)
```

### 5.3 Performance Strategy

| Data Type | Freshness | Method | Cache TTL |
|-----------|-----------|--------|-----------|
| KPI cards (totals) | Real-time | RPC function | 60 seconds (TanStack Query) |
| Funnel data | Near-real-time | Materialized view | 5 minutes |
| Store breakdown | Near-real-time | Materialized view | 5 minutes |
| Category distribution | Near-real-time | Materialized view | 5 minutes |
| Registry economics | Near-real-time | RPC function | 5 minutes |
| GA4 data | Daily | Server-side API call | 1 hour |
| Trend charts (daily) | Daily | Materialized view | 1 hour |

---

## 6. Metric Definitions & Data Sources

### 6.1 North Star Metric

| Metric | Definition | SQL Source |
|--------|-----------|------------|
| **Active Gifted Registries (30d)** | Registries that received ≥1 confirmed purchase in the last 30 days | `SELECT COUNT(DISTINCT r.id) FROM registries r JOIN items i ON i.registry_id = r.id JOIN purchases p ON p.item_id = i.id WHERE p.status = 'confirmed' AND p.confirmed_at >= NOW() - INTERVAL '30 days'` |

### 6.2 Funnel Metrics

| Stage | Metric | Source | Calculation |
|-------|--------|--------|-------------|
| 1 | Total Signups | `profiles` | `COUNT(*) WHERE created_at IN period` |
| 2 | Onboarding Completed | `profiles` | `COUNT(*) WHERE onboarding_completed = true` |
| 3 | Added First Item | `items` joined to `registries` | `COUNT(DISTINCT r.owner_id) WHERE EXISTS(SELECT 1 FROM items WHERE registry_id = r.id)` |
| 4 | Added 5+ Items | `items` grouped | `COUNT(DISTINCT r.owner_id) WHERE (SELECT COUNT(*) FROM items WHERE registry_id = r.id) >= 5` |
| 5 | Shared Registry | GA4 event `registry_shared` | Count of distinct user_ids with event |
| 6 | Registry Viewed | GA4 event `registry_viewed` OR `purchases` exists | Distinct registries with ≥1 view |
| 7 | Received Gift | `purchases` | `COUNT(DISTINCT r.owner_id) WHERE EXISTS(confirmed purchase)` |

**Conversion rates:** Each stage shows `(stage N count / stage N-1 count) * 100` as a percentage.

### 6.3 Registry Economics

| Metric | Definition | Calculation |
|--------|-----------|-------------|
| **Avg. Registry Value (₪)** | Mean total value of items across all registries | `AVG(registry_total) WHERE registry_total = SUM(items.price * items.quantity) per registry` |
| **Median Registry Value (₪)** | Median (more robust to outliers) | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY registry_total)` |
| **Avg. Items per Registry** | Mean item count | `AVG(item_count) WHERE item_count = COUNT(items) per registry` |
| **Registry Completion Rate** | % of items that get purchased | `SUM(quantity_received) / SUM(quantity) * 100 across all items` |
| **Avg. Gift Value (₪)** | Mean price of items that were purchased | `AVG(items.price) WHERE items.quantity_received > 0` |
| **Avg. Gifts per Registry** | Mean number of gifts received per registry | `AVG(gift_count) WHERE gift_count = SUM(quantity_received) per registry` |
| **Total Platform GMV (₪)** | Gross merchandise value of all purchased items | `SUM(items.price * items.quantity_received)` |

### 6.4 Store Metrics

| Metric | Definition | Source |
|--------|-----------|--------|
| **Store Ranking (by count)** | Stores ordered by number of items added | `GROUP BY store_domain, COUNT(*)` |
| **Store Ranking (by value)** | Stores ordered by total ₪ value | `GROUP BY store_domain, SUM(price * quantity)` |
| **Store Purchase Rate** | % of items from store X that get purchased | `SUM(quantity_received) / SUM(quantity) per store` |
| **Store Avg. Price** | Average item price per store | `AVG(price) per store` |

**Store normalization:** Extract domain from `items.original_url` using `regexp_replace(original_url, '^https?://([^/]+).*', '\1')`. Map common variations:
- `www.shilav.co.il`, `shilav.co.il` → `shilav.co.il`
- `he.aliexpress.com`, `aliexpress.com` → `aliexpress.com`
- Manual entries (no URL) → `manual` group

### 6.5 Category Metrics

| Metric | Definition |
|--------|-----------|
| **Items by Category** | Distribution of items across the 10 categories |
| **Value by Category** | Total ₪ value per category |
| **Purchase Rate by Category** | Which categories get bought most |
| **Checklist vs. Registry** | Compare checklist category preferences to actual registry categories |

### 6.6 Extension Metrics

| Metric | Definition |
|--------|-----------|
| **Extension Users** | Users who have added ≥1 item with `store_name != 'ידני'` AND `original_url IS NOT NULL` |
| **Extension Adoption Rate** | Extension users / total users with ≥1 item |
| **Extension Uplift** | Avg. items per registry (extension users) vs. (non-extension users) |
| **Items via Extension** | Items where `original_url IS NOT NULL AND store_name != 'ידני'` |

### 6.7 Gift Giver Metrics

| Metric | Definition |
|--------|-----------|
| **Purchase Confirmation Rate** | Confirmed purchases / total purchases |
| **Avg. Time to Confirm** | Mean time between `purchases.created_at` and `purchases.confirmed_at` |
| **Surprise Gift Rate** | Purchases where `is_surprise = true` / total purchases |
| **Gift Message Rate** | Purchases where `gift_message IS NOT NULL` / total purchases |
| **Unique Gift Givers** | `COUNT(DISTINCT buyer_email)` across all purchases |
| **Avg. Gifts per Gift Giver** | Total confirmed purchases / unique gift givers |

---

## 7. Screen-by-Screen Specification

### 7.1 Navigation Structure

```
┌────────────────────────────────────────────────┐
│  🪺 Nesty Dashboard          [Jack] [Logout]  │
├────────────────────────────────────────────────┤
│                                                │
│  Sidebar:                                      │
│  ┌──────────┐                                  │
│  │ Overview  │  ← Default landing page         │
│  │ Funnel    │                                  │
│  │ Economics │                                  │
│  │ Stores    │                                  │
│  │ Categories│                                  │
│  │ Extension │                                  │
│  │ Gifts     │                                  │
│  │ Growth    │                                  │
│  │ Timeline  │                                  │
│  │ ──────── │                                  │
│  │ Settings  │  ← Manage access, preferences   │
│  └──────────┘                                  │
│                                                │
│  Main content area (right side)                │
│                                                │
└────────────────────────────────────────────────┘
```

### 7.2 Screen: Overview (Home)

The landing page. Gives a CEO-level snapshot in 10 seconds.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│  Date Range Picker: [Last 7 days ▼]  [vs. Previous Period ☐]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐│
│  │ North Star  │ │  Total      │ │  Active     │ │ Platform ││
│  │ Gifted Regs │ │  Users      │ │  Registries │ │ GMV (₪)  ││
│  │             │ │             │ │             │ │          ││
│  │    42       │ │   1,280     │ │    890      │ │ 245,000  ││
│  │   ↑ 12%    │ │   ↑ 8%     │ │   ↑ 5%     │ │ ↑ 15%   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘│
│                                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐│
│  │ Avg Registry│ │ Avg Items   │ │ Completion  │ │ Extension││
│  │ Value (₪)   │ │ per Registry│ │ Rate        │ │ Adoption ││
│  │             │ │             │ │             │ │          ││
│  │  ₪8,450    │ │   23        │ │   62%       │ │  34%     ││
│  │   ↑ 3%     │ │   ↑ 2      │ │   ↑ 4pp    │ │  ↑ 8pp  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘│
│                                                                │
│  ┌──────────────────────────┐ ┌──────────────────────────────┐ │
│  │  Signups Over Time       │ │  Mini Funnel                 │ │
│  │  (Line Chart, daily)     │ │  (Horizontal bar chart)      │ │
│  │                          │ │                              │ │
│  │  ───────────/──          │ │  Signups ████████████ 1280   │ │
│  │            /             │ │  Onboard ██████████   1050   │ │
│  │  ─────────               │ │  1+ Item ████████     780    │ │
│  │                          │ │  5+ Item ██████       520    │ │
│  │                          │ │  Shared  ████         340    │ │
│  │                          │ │  Gifted  ██           180    │ │
│  └──────────────────────────┘ └──────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────┐ ┌──────────────────────────────┐ │
│  │  Top 5 Stores            │ │  Category Distribution       │ │
│  │  (Horizontal bars)       │ │  (Donut chart)               │ │
│  │                          │ │                              │ │
│  │  shilav.co.il  ████ 180  │ │      ┌──────┐               │ │
│  │  aliexpress.com ███ 145  │ │     /  strol \              │ │
│  │  amazon.com    ██  98    │ │    │ feeding │              │ │
│  │  ksp.co.il     ██  87    │ │     \  bath  /              │ │
│  │  motzetzim.co  █   54    │ │      └──────┘               │ │
│  └──────────────────────────┘ └──────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**KPI Cards Specification:**

| Card | Primary Value | Comparison | Source |
|------|--------------|------------|--------|
| North Star (Gifted Registries) | Count of registries with ≥1 confirmed purchase in period | vs. previous period | Supabase RPC |
| Total Users | `COUNT(profiles)` in period | vs. previous | Supabase direct |
| Active Registries | Registries with ≥1 item added in period | vs. previous | Supabase RPC |
| Platform GMV | `SUM(price * quantity_received)` in period | vs. previous | Supabase RPC |
| Avg. Registry Value | Mean registry total value | vs. previous | Supabase RPC |
| Avg. Items per Registry | Mean item count per registry | vs. previous | Supabase RPC |
| Completion Rate | Items received / items wanted | vs. previous | Supabase RPC |
| Extension Adoption | Users with extension / total active users | vs. previous | Supabase RPC |

### 7.3 Screen: Funnel

Deep dive into the user conversion funnel.

**Components:**

1. **Funnel Visualization** — Vertical funnel chart showing 7 stages with absolute numbers and conversion rates between each stage.

2. **Conversion Rate Table** — Each stage pair with:
   - Stage name
   - Count
   - Conversion from previous stage (%)
   - Conversion from signup (%)
   - Change vs. previous period

3. **Cohort Selector** — Filter by signup month to see how specific cohorts progress through the funnel over time.

4. **Time-to-Stage Chart** — How long (in days) it takes the average user to reach each stage:
   - Signup → Onboarding: typically <1 day
   - Onboarding → First Item: typically 0–3 days
   - First Item → 5+ Items: typically 3–14 days
   - 5+ Items → Share: typically 7–21 days
   - Share → First Gift: typically 7–30 days

### 7.4 Screen: Economics

Registry economics deep dive for affiliate pitch preparation.

**Components:**

1. **Economics KPI Cards:**
   - Total Platform GMV (₪)
   - Average Registry Value (₪)
   - Median Registry Value (₪)
   - Average Gift Value (₪)
   - Total Gifts Given
   - Average Gifts per Registry

2. **Registry Value Distribution** — Histogram showing how many registries fall in each ₪ range (0–2K, 2K–5K, 5K–10K, 10K–20K, 20K+)

3. **Value Over Time** — Line chart showing average registry value trend (monthly)

4. **Completion Rate by Category** — Bar chart showing which categories have the highest/lowest purchase completion rates

5. **"Affiliate Pitch" Summary Card** — Auto-generated text block:
   > "Nesty has {X} active registries with an average value of ₪{Y}. {Z}% of registry items get purchased. The top store is {store} with {N} items worth ₪{V}. This represents a ₪{GMV} total addressable market for affiliate partnerships."

### 7.5 Screen: Stores

Store distribution analysis for partnership prioritization.

**Components:**

1. **Store Ranking Table** (sortable, paginated):
   | Rank | Store | Items | Total Value (₪) | Avg. Price (₪) | Purchase Rate | Registries |
   |------|-------|-------|-----------------|----------------|---------------|------------|
   | 1 | shilav.co.il | 180 | ₪52,400 | ₪291 | 68% | 89 |
   | 2 | aliexpress.com | 145 | ₪18,200 | ₪126 | 45% | 72 |
   | ... | ... | ... | ... | ... | ... | ... |

2. **Top 10 Stores Bar Chart** — Dual-axis: item count (bars) + total value (line)

3. **Store Market Share Pie Chart** — By item count and by value (toggle)

4. **Store Trend** — Line chart showing top 5 stores' item count over time (are users shifting to different stores?)

5. **"Manual" vs. "Extension" Split** — Of items with `store_name = 'ידני'` vs. items with a real store, show the ratio and trend.

### 7.6 Screen: Categories

Category distribution for understanding what Israeli parents actually need.

**Components:**

1. **Category Distribution Pie Chart** — Items by category (count)
2. **Category Value Pie Chart** — Total ₪ by category
3. **Category Table:**
   | Category | Items | % of Total | Total Value (₪) | Avg. Price | Purchase Rate |
   |----------|-------|-----------|-----------------|------------|---------------|
   | Strollers | 210 | 18% | ₪145,000 | ₪690 | 72% |
   | ... | ... | ... | ... | ... | ... |

4. **Checklist vs. Registry Comparison:**
   - Radar/spider chart showing the 5 checklist categories (what parents plan to buy) overlaid with the 10 registry categories (what they actually add)
   - Highlights gaps: if "safety" is high on checklists but low in registries, there's a product opportunity

5. **Category by Store Matrix** — Heatmap showing which stores are popular for which categories

### 7.7 Screen: Extension

Chrome extension adoption and impact analysis.

**Components:**

1. **Extension KPI Cards:**
   - Total Extension Users
   - Extension Adoption Rate (%)
   - Items Added via Extension
   - Extension vs. Manual/Paste ratio

2. **Extension Uplift Comparison:**
   | Metric | Extension Users | Non-Extension Users | Uplift |
   |--------|----------------|--------------------|---------|
   | Avg. Items | 31 | 12 | +158% |
   | Avg. Registry Value | ₪12,400 | ₪4,200 | +195% |
   | Completion Rate | 68% | 48% | +42% |
   | Shared Registry | 82% | 51% | +61% |

3. **Extension Adoption Over Time** — Line chart showing extension user count growth

4. **Top Stores via Extension** — Which stores do extension users add from most?

### 7.8 Screen: Gifts

Gift giver behavior and purchase funnel.

**Components:**

1. **Gift KPI Cards:**
   - Total Gifts Given (confirmed)
   - Unique Gift Givers
   - Purchase Confirmation Rate
   - Avg. Time to Confirm

2. **Purchase Status Funnel:**
   - Created (pending) → Confirmed → Received → Thanked
   - Show conversion at each step

3. **Gift Category Distribution** — Pie chart of purchased items by category

4. **Surprise Gift Rate** — % of gifts marked as surprise

5. **Gift Giver Frequency** — Distribution: how many gift givers buy 1 item vs. 2+ items (identifies "power gift givers")

6. **Gifts Over Time** — Line chart showing confirmed purchases per week

### 7.9 Screen: Growth

User acquisition and viral loop metrics.

**Components:**

1. **Growth KPI Cards:**
   - New Signups (period)
   - Weekly Growth Rate (%)
   - Registries Shared (period)
   - Share-to-Signup Ratio (viral coefficient proxy)

2. **Signup Trend** — Daily signups line chart with 7-day moving average

3. **Sharing Methods Breakdown** — Pie chart of share methods (WhatsApp, email, link, QR)

4. **Shares vs. Signups Correlation** — Dual-axis chart: shares per week vs. new signups per week (shows if sharing drives growth)

5. **GA4 Acquisition Channels** — Source/medium breakdown from GA4 API (organic, direct, social, referral)

### 7.10 Screen: Timeline (Pregnancy-Based)

Behavior analysis relative to due date.

**Components:**

1. **Activity by Pregnancy Week** — Stacked area chart showing:
   - Items added per week (relative to due date)
   - Gifts received per week (relative to due date)

2. **Key Moments:**
   - Average week of first item added
   - Average week of registry share
   - Average week of first gift received
   - Peak activity week

3. **Due Date Distribution** — Calendar heatmap showing when users' due dates fall (seasonal patterns)

### 7.11 Screen: Settings

Dashboard configuration.

**Components:**

1. **Access Management** — Table of approved emails with add/remove functionality
2. **Data Refresh** — Manual trigger for materialized view refresh + last refresh timestamp
3. **GA4 Connection Status** — Show if GA4 API is connected and last sync time

---

## 8. Supabase Backend: Views, RPCs & Schema

### 8.1 Dashboard Access Table

```sql
CREATE TABLE dashboard_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only authenticated dashboard users can read
ALTER TABLE dashboard_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read access list"
  ON dashboard_access FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage access"
  ON dashboard_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_access
      WHERE email = auth.jwt()->>'email'
      AND role = 'admin'
    )
  );
```

### 8.2 Materialized View: Daily Metrics

```sql
CREATE MATERIALIZED VIEW mv_daily_metrics AS
SELECT
  date_trunc('day', p.created_at)::date AS day,

  -- Signups
  COUNT(DISTINCT p.id) AS signups,
  COUNT(DISTINCT p.id) FILTER (WHERE p.onboarding_completed = true) AS onboarded,

  -- Registries
  COUNT(DISTINCT r.id) AS registries_created,

  -- Items (joined separately for accuracy)
  (SELECT COUNT(*) FROM items i
   JOIN registries r2 ON i.registry_id = r2.id
   WHERE date_trunc('day', i.created_at)::date = date_trunc('day', p.created_at)::date
  ) AS items_added,

  -- Purchases
  (SELECT COUNT(*) FROM purchases pu
   WHERE pu.status = 'confirmed'
   AND date_trunc('day', pu.confirmed_at)::date = date_trunc('day', p.created_at)::date
  ) AS gifts_confirmed

FROM profiles p
LEFT JOIN registries r ON r.owner_id = p.id
  AND date_trunc('day', r.created_at)::date = date_trunc('day', p.created_at)::date
GROUP BY date_trunc('day', p.created_at)::date
ORDER BY day DESC;

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_daily_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.3 Materialized View: Store Breakdown

```sql
CREATE MATERIALIZED VIEW mv_store_breakdown AS
SELECT
  -- Normalize store domain from URL
  CASE
    WHEN original_url IS NULL OR original_url = '' THEN 'manual'
    ELSE regexp_replace(
      regexp_replace(original_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    )
  END AS store_domain,

  -- Also keep the user-entered store_name for display
  COALESCE(NULLIF(store_name, 'ידני'), 'Manual Entry') AS store_display_name,

  COUNT(*) AS item_count,
  COUNT(DISTINCT i.registry_id) AS registry_count,
  ROUND(AVG(i.price)::numeric, 2) AS avg_price,
  SUM(i.price * i.quantity) AS total_value,
  SUM(i.quantity_received) AS total_purchased,
  SUM(i.quantity) AS total_wanted,
  CASE
    WHEN SUM(i.quantity) > 0
    THEN ROUND((SUM(i.quantity_received)::numeric / SUM(i.quantity)::numeric) * 100, 1)
    ELSE 0
  END AS purchase_rate

FROM items i
GROUP BY store_domain, store_display_name
ORDER BY item_count DESC;
```

### 8.4 Materialized View: Funnel Snapshot

```sql
CREATE MATERIALIZED VIEW mv_funnel_snapshot AS
WITH
  stage1_signups AS (
    SELECT COUNT(*) AS cnt FROM profiles
  ),
  stage2_onboarded AS (
    SELECT COUNT(*) AS cnt FROM profiles WHERE onboarding_completed = true
  ),
  stage3_first_item AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    WHERE EXISTS (SELECT 1 FROM items WHERE registry_id = r.id)
  ),
  stage4_five_items AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    WHERE (SELECT COUNT(*) FROM items WHERE registry_id = r.id) >= 5
  ),
  stage5_shared AS (
    -- Approximation: registries with welcome_message set or address configured
    -- Ideally supplement with GA4 registry_shared event count
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    WHERE r.title IS NOT NULL
    AND EXISTS (SELECT 1 FROM items WHERE registry_id = r.id LIMIT 1)
  ),
  stage6_viewed AS (
    -- Registries where at least one purchase attempt exists (someone viewed and acted)
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    JOIN items i ON i.registry_id = r.id
    JOIN purchases p ON p.item_id = i.id
  ),
  stage7_gifted AS (
    SELECT COUNT(DISTINCT r.owner_id) AS cnt
    FROM registries r
    JOIN items i ON i.registry_id = r.id
    JOIN purchases p ON p.item_id = i.id
    WHERE p.status = 'confirmed'
  )
SELECT
  'signups' AS stage, 1 AS stage_order, s1.cnt AS count FROM stage1_signups s1
UNION ALL
SELECT 'onboarded', 2, s2.cnt FROM stage2_onboarded s2
UNION ALL
SELECT 'first_item', 3, s3.cnt FROM stage3_first_item s3
UNION ALL
SELECT 'five_items', 4, s4.cnt FROM stage4_five_items s4
UNION ALL
SELECT 'shared', 5, s5.cnt FROM stage5_shared s5
UNION ALL
SELECT 'viewed', 6, s6.cnt FROM stage6_viewed s6
UNION ALL
SELECT 'gifted', 7, s7.cnt FROM stage7_gifted s7;
```

### 8.5 RPC: Dashboard Overview

```sql
CREATE OR REPLACE FUNCTION get_dashboard_overview(
  period_start TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  period_end TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles WHERE created_at <= period_end),
    'new_users', (SELECT COUNT(*) FROM profiles WHERE created_at BETWEEN period_start AND period_end),
    'active_registries', (
      SELECT COUNT(DISTINCT r.id)
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      WHERE i.created_at BETWEEN period_start AND period_end
    ),
    'total_items', (SELECT COUNT(*) FROM items WHERE created_at BETWEEN period_start AND period_end),
    'total_gifts', (
      SELECT COUNT(*) FROM purchases
      WHERE status = 'confirmed'
      AND confirmed_at BETWEEN period_start AND period_end
    ),
    'platform_gmv', (
      SELECT COALESCE(SUM(i.price * i.quantity_received), 0)
      FROM items i
      JOIN purchases p ON p.item_id = i.id
      WHERE p.status = 'confirmed'
      AND p.confirmed_at BETWEEN period_start AND period_end
    ),
    'avg_registry_value', (
      SELECT ROUND(AVG(reg_total)::numeric, 2)
      FROM (
        SELECT SUM(i.price * i.quantity) AS reg_total
        FROM items i
        GROUP BY i.registry_id
        HAVING COUNT(*) >= 1
      ) sub
    ),
    'avg_items_per_registry', (
      SELECT ROUND(AVG(item_count)::numeric, 1)
      FROM (
        SELECT COUNT(*) AS item_count
        FROM items
        GROUP BY registry_id
      ) sub
    ),
    'completion_rate', (
      SELECT CASE
        WHEN SUM(quantity) > 0
        THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
        ELSE 0
      END
      FROM items
    ),
    'north_star', (
      SELECT COUNT(DISTINCT r.id)
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      JOIN purchases p ON p.item_id = i.id
      WHERE p.status = 'confirmed'
      AND p.confirmed_at >= NOW() - INTERVAL '30 days'
    ),
    'extension_users', (
      SELECT COUNT(DISTINCT r.owner_id)
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      WHERE i.original_url IS NOT NULL
      AND i.store_name != 'ידני'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.6 RPC: Registry Economics

```sql
CREATE OR REPLACE FUNCTION get_registry_economics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_gmv', (
      SELECT COALESCE(SUM(price * quantity_received), 0) FROM items
    ),
    'avg_registry_value', (
      SELECT ROUND(AVG(reg_total)::numeric, 2)
      FROM (
        SELECT SUM(price * quantity) AS reg_total
        FROM items GROUP BY registry_id HAVING COUNT(*) >= 1
      ) sub
    ),
    'median_registry_value', (
      SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY reg_total)::numeric, 2)
      FROM (
        SELECT SUM(price * quantity) AS reg_total
        FROM items GROUP BY registry_id HAVING COUNT(*) >= 1
      ) sub
    ),
    'avg_gift_value', (
      SELECT ROUND(AVG(price)::numeric, 2)
      FROM items WHERE quantity_received > 0
    ),
    'avg_items_per_registry', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (SELECT COUNT(*) AS cnt FROM items GROUP BY registry_id) sub
    ),
    'avg_gifts_per_registry', (
      SELECT ROUND(AVG(gifts)::numeric, 1)
      FROM (
        SELECT SUM(quantity_received) AS gifts
        FROM items GROUP BY registry_id
      ) sub
    ),
    'completion_rate', (
      SELECT CASE
        WHEN SUM(quantity) > 0
        THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
        ELSE 0
      END FROM items
    ),
    'value_distribution', (
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT
          bucket,
          COUNT(*) AS registry_count
        FROM (
          SELECT
            CASE
              WHEN reg_total < 2000 THEN '0-2K'
              WHEN reg_total < 5000 THEN '2K-5K'
              WHEN reg_total < 10000 THEN '5K-10K'
              WHEN reg_total < 20000 THEN '10K-20K'
              ELSE '20K+'
            END AS bucket
          FROM (
            SELECT SUM(price * quantity) AS reg_total
            FROM items GROUP BY registry_id HAVING COUNT(*) >= 1
          ) totals
        ) bucketed
        GROUP BY bucket
        ORDER BY
          CASE bucket
            WHEN '0-2K' THEN 1
            WHEN '2K-5K' THEN 2
            WHEN '5K-10K' THEN 3
            WHEN '10K-20K' THEN 4
            WHEN '20K+' THEN 5
          END
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.7 RPC: Extension Metrics

```sql
CREATE OR REPLACE FUNCTION get_extension_metrics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'extension_users', (
      SELECT COUNT(DISTINCT r.owner_id)
      FROM registries r
      JOIN items i ON i.registry_id = r.id
      WHERE i.original_url IS NOT NULL AND i.store_name != 'ידני'
    ),
    'non_extension_users', (
      SELECT COUNT(DISTINCT r.owner_id)
      FROM registries r
      WHERE NOT EXISTS (
        SELECT 1 FROM items i
        WHERE i.registry_id = r.id
        AND i.original_url IS NOT NULL
        AND i.store_name != 'ידני'
      )
      AND EXISTS (SELECT 1 FROM items WHERE registry_id = r.id)
    ),
    'items_via_extension', (
      SELECT COUNT(*) FROM items
      WHERE original_url IS NOT NULL AND store_name != 'ידני'
    ),
    'items_manual', (
      SELECT COUNT(*) FROM items
      WHERE original_url IS NULL OR store_name = 'ידני'
    ),
    'ext_avg_items', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (
        SELECT COUNT(*) AS cnt
        FROM items i
        JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id IN (
          SELECT DISTINCT r2.owner_id
          FROM registries r2
          JOIN items i2 ON i2.registry_id = r2.id
          WHERE i2.original_url IS NOT NULL AND i2.store_name != 'ידני'
        )
        GROUP BY i.registry_id
      ) sub
    ),
    'non_ext_avg_items', (
      SELECT ROUND(AVG(cnt)::numeric, 1)
      FROM (
        SELECT COUNT(*) AS cnt
        FROM items i
        JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id NOT IN (
          SELECT DISTINCT r2.owner_id
          FROM registries r2
          JOIN items i2 ON i2.registry_id = r2.id
          WHERE i2.original_url IS NOT NULL AND i2.store_name != 'ידני'
        )
        GROUP BY i.registry_id
      ) sub
    ),
    'ext_avg_value', (
      SELECT ROUND(AVG(val)::numeric, 2)
      FROM (
        SELECT SUM(i.price * i.quantity) AS val
        FROM items i
        JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id IN (
          SELECT DISTINCT r2.owner_id
          FROM registries r2
          JOIN items i2 ON i2.registry_id = r2.id
          WHERE i2.original_url IS NOT NULL AND i2.store_name != 'ידני'
        )
        GROUP BY i.registry_id
      ) sub
    ),
    'non_ext_avg_value', (
      SELECT ROUND(AVG(val)::numeric, 2)
      FROM (
        SELECT SUM(i.price * i.quantity) AS val
        FROM items i
        JOIN registries r ON i.registry_id = r.id
        WHERE r.owner_id NOT IN (
          SELECT DISTINCT r2.owner_id
          FROM registries r2
          JOIN items i2 ON i2.registry_id = r2.id
          WHERE i2.original_url IS NOT NULL AND i2.store_name != 'ידני'
        )
        GROUP BY i.registry_id
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.8 Materialized View Refresh Schedule

```sql
-- Create a pg_cron job to refresh views every 5 minutes
-- (Requires pg_cron extension enabled in Supabase)

SELECT cron.schedule(
  'refresh-dashboard-views',
  '*/5 * * * *',
  $$
    SELECT refresh_daily_metrics();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_store_breakdown;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_snapshot;
  $$
);
```

**Note:** If `pg_cron` is not available on the Supabase plan, the dashboard frontend can trigger refresh via an RPC call, or a Supabase Edge Function can run on a schedule.

---

## 9. Google Analytics 4 Integration

### 9.1 Existing GA4 Setup

- **GTM Container:** `GTM-KGM8H82F`
- **Custom Events Already Defined:** 13 events including `registry_created`, `registry_shared`, `item_added`, `gift_purchased`, `onboarding_step`, etc.
- **Meta Pixel:** Integrated for `CompleteRegistration` event

### 9.2 GA4 Data API Integration

The dashboard will use the [GA4 Data API v1](https://developers.google.com/analytics/devguides/reporting/data/v1) to pull analytics data server-side.

**Required Setup:**

1. Create a Google Cloud project (or use existing)
2. Enable the Google Analytics Data API
3. Create a service account with "Viewer" role on the GA4 property
4. Download the service account JSON key
5. Store key securely (environment variable or Supabase Vault)

**Data to Pull from GA4:**

| Metric | GA4 API Call | Dashboard Usage |
|--------|-------------|-----------------|
| Sessions (daily) | `runReport` with `sessions` metric, `date` dimension | Growth chart overlay |
| Active Users | `runReport` with `activeUsers` | Overview KPI (supplement Supabase data) |
| Page Views by Path | `runReport` with `screenPageViews`, `pagePath` dimension | Identify most-visited pages |
| Event Counts | `runReport` with `eventCount`, `eventName` dimension | Funnel stages (registry_shared, registry_viewed) |
| Acquisition Source | `runReport` with `sessions`, `sessionSource`+`sessionMedium` | Growth screen: traffic sources |
| Registry Views | Custom event `registry_viewed` count | Funnel stage 6 |

### 9.3 GA4 Proxy Endpoint

To avoid exposing GA4 credentials to the frontend, the dashboard should include a lightweight server-side proxy:

**Option A: Supabase Edge Function**
```typescript
// supabase/functions/ga4-proxy/index.ts
import { BetaAnalyticsDataClient } from '@google-analytics/data';

Deno.serve(async (req) => {
  const client = new BetaAnalyticsDataClient({
    credentials: JSON.parse(Deno.env.get('GA4_SERVICE_ACCOUNT_KEY')!)
  });

  const [response] = await client.runReport({
    property: `properties/${Deno.env.get('GA4_PROPERTY_ID')}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    dimensions: [{ name: 'date' }]
  });

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

**Option B: Vite Dev Server Proxy (development)**
Similar to Nesty web's mock API pattern in `vite.config.ts`, add a proxy endpoint that calls GA4 server-side.

---

## 10. Tech Stack & Infrastructure

### 10.1 Frontend Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | React 19 + Vite + TypeScript | Same as Nesty web — team familiarity, fast builds |
| **UI Components** | shadcn/ui + Tailwind CSS | Pre-built dashboard components, copy-paste philosophy, owns the code |
| **Charts** | Recharts | Lightweight, SVG-based, responsive, great React integration |
| **Data Fetching** | TanStack Query v5 | Background polling, caching, stale-while-revalidate for real-time feel |
| **Routing** | React Router v6 | Consistent with Nesty web |
| **State Management** | React Context + TanStack Query | No need for Redux — TanStack handles server state |
| **Icons** | Lucide React | Consistent with Nesty web |
| **Date Handling** | date-fns | Lightweight, tree-shakable |

**Why React + Vite over Next.js?** Since the dashboard is a purely client-side SPA that connects directly to Supabase (similar to Nesty web), there's no need for Next.js's server-side rendering. Keeping the same stack as the main app means the team can maintain both with the same knowledge. The GA4 proxy can be handled by a Supabase Edge Function instead of Next.js API routes.

### 10.2 Backend (Supabase)

| Component | Usage |
|-----------|-------|
| **Supabase Auth** | Google OAuth for dashboard access |
| **Supabase Database** | Direct queries + materialized views + RPC functions |
| **Supabase Realtime** | Optional: subscribe to new signups/purchases for live counters |
| **Supabase Edge Functions** | GA4 API proxy, materialized view refresh trigger |
| **Supabase Vault** | Store GA4 service account credentials securely |

### 10.3 Project Structure

```
nesty-dashboard/
├── PRD.md                          # This document
├── README.md                       # Setup & deployment guide
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
│
├── public/
│   └── favicon.svg
│
├── src/
│   ├── main.tsx                    # App entry point
│   ├── App.tsx                     # Router setup
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx # Sidebar + main content
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   │
│   │   ├── charts/
│   │   │   ├── FunnelChart.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── TrendLine.tsx
│   │   │   ├── PieChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   └── TimelineChart.tsx
│   │   │
│   │   └── shared/
│   │       ├── DateRangePicker.tsx
│   │       ├── PeriodComparison.tsx
│   │       ├── LoadingSkeleton.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── OverviewPage.tsx
│   │   ├── FunnelPage.tsx
│   │   ├── EconomicsPage.tsx
│   │   ├── StoresPage.tsx
│   │   ├── CategoriesPage.tsx
│   │   ├── ExtensionPage.tsx
│   │   ├── GiftsPage.tsx
│   │   ├── GrowthPage.tsx
│   │   ├── TimelinePage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── hooks/
│   │   ├── useOverviewData.ts      # TanStack Query hook
│   │   ├── useFunnelData.ts
│   │   ├── useEconomicsData.ts
│   │   ├── useStoreData.ts
│   │   ├── useCategoryData.ts
│   │   ├── useExtensionData.ts
│   │   ├── useGiftData.ts
│   │   ├── useGrowthData.ts
│   │   └── useGA4Data.ts
│   │
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client (same project, different auth)
│   │   ├── ga4.ts                  # GA4 API helper
│   │   ├── formatters.ts           # Currency, number, date formatting
│   │   └── storeNormalizer.ts      # URL → store domain normalization
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Dashboard auth (separate from main app)
│   │   └── DateRangeContext.tsx     # Global date range state
│   │
│   └── types/
│       ├── dashboard.ts            # TypeScript interfaces
│       └── supabase.ts             # Database types
│
├── supabase/
│   ├── migrations/
│   │   └── 001_dashboard_schema.sql  # Dashboard-specific tables & views
│   └── functions/
│       ├── ga4-proxy/
│       │   └── index.ts            # GA4 API proxy
│       └── refresh-views/
│           └── index.ts            # Materialized view refresh trigger
│
└── sql/
    ├── materialized_views.sql      # All MV definitions
    ├── rpc_functions.sql           # All RPC function definitions
    └── seed_dashboard_access.sql   # Initial admin email(s)
```

---

## 11. Authentication & Security

### 11.1 Authentication Flow

```
User navigates to dashboard.nestyil.com
    │
    ▼
LoginPage: "Sign in with Google" button
    │
    ▼
Supabase Auth: Google OAuth
    │
    ▼
Post-login check:
    SELECT * FROM dashboard_access
    WHERE email = {user_email}
    │
    ├── Email found → Redirect to /overview
    │
    └── Email NOT found → Show "Access Denied" message
        "Your email is not authorized. Contact the admin."
        + Supabase sign-out
```

### 11.2 Security Measures

- **Email allowlist:** Only pre-approved emails can access the dashboard
- **No self-registration:** Users cannot create accounts themselves
- **Admin role:** Only admins can add/remove emails from the allowlist
- **SECURITY DEFINER RPCs:** All dashboard RPC functions use `SECURITY DEFINER` to bypass RLS (dashboard queries need cross-user data, but are only accessible to authenticated dashboard users)
- **Separate from main app auth:** Dashboard authentication is independent of Nesty user auth. A Nesty user cannot access the dashboard unless their email is in `dashboard_access`.
- **CORS:** Configure Supabase CORS to allow `dashboard.nestyil.com` origin

### 11.3 Initial Admin Setup

```sql
-- Seed the first admin
INSERT INTO dashboard_access (email, display_name, role)
VALUES ('tom@ppltok.com', 'Jack', 'admin');
```

---

## 12. Deployment & Hosting

### 12.1 Hosting Options

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **GitHub Pages (subdomain)** | Free, same as main site, familiar deployment | No server-side (need Edge Functions for GA4) | Good for MVP |
| **Vercel** | Easy deployment, serverless functions, custom domain | Another platform to manage | Good alternative |
| **Cloudflare Pages** | Free, fast CDN, Workers for server functions | New platform | Overkill for internal tool |

**Recommendation:** GitHub Pages at `dashboard.nestyil.com` with Supabase Edge Functions handling server-side needs (GA4 proxy, view refresh). This keeps the infrastructure consistent with the main site.

### 12.2 Domain Configuration

```
nestyil.com          → Main Nesty web app (GitHub Pages)
dashboard.nestyil.com → Dashboard app (GitHub Pages, separate repo or branch)
```

**DNS Setup:**
- CNAME record: `dashboard.nestyil.com` → `ppltok.github.io`
- Configure in GitHub Pages settings for the dashboard repo

### 12.3 Environment Variables

```env
# .env.production
VITE_SUPABASE_URL=https://wopsrjfdaovlyibivijl.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_GA4_PROPERTY_ID=<ga4-property-id>
VITE_DASHBOARD_BASE_PATH=/
```

---

## 13. Implementation Phases

### Phase 1: Foundation (Week 1)

**Backend:**
- [ ] Create `dashboard_access` table in Supabase
- [ ] Seed initial admin email
- [ ] Create materialized views: `mv_funnel_snapshot`, `mv_store_breakdown`
- [ ] Create RPC: `get_dashboard_overview()`
- [ ] Create RPC: `get_registry_economics()`
- [ ] Set up materialized view refresh (pg_cron or Edge Function)

**Frontend:**
- [ ] Initialize Vite + React + TypeScript project
- [ ] Install and configure: shadcn/ui, Recharts, TanStack Query, Supabase client
- [ ] Build LoginPage with Google OAuth + allowlist check
- [ ] Build DashboardLayout (sidebar navigation + header)
- [ ] Build OverviewPage with 8 KPI cards
- [ ] Build mini funnel chart on Overview
- [ ] Build signup trend line chart

**Deliverable:** Working dashboard at localhost with auth, overview KPIs, and mini funnel.

### Phase 2: Deep Dives (Week 2)

**Backend:**
- [ ] Create RPCs: `get_extension_metrics()`, `get_gift_giver_insights()`
- [ ] Create `mv_daily_metrics` materialized view
- [ ] Create category distribution RPC

**Frontend:**
- [ ] Build FunnelPage with full 7-stage funnel + conversion rates
- [ ] Build EconomicsPage with value distribution histogram
- [ ] Build StoresPage with ranking table + bar chart
- [ ] Build CategoriesPage with pie charts + table
- [ ] Build ExtensionPage with uplift comparison table
- [ ] Build GiftsPage with confirmation funnel

**Deliverable:** All core screens functional with real data.

### Phase 3: Growth & Polish (Week 3)

**Backend:**
- [ ] Set up GA4 Data API integration (Edge Function proxy)
- [ ] Create growth-related RPCs

**Frontend:**
- [ ] Build GrowthPage with signup trends + sharing metrics
- [ ] Build TimelinePage with pregnancy-week-based charts
- [ ] Add date range picker + period comparison across all screens
- [ ] Add loading skeletons and empty states
- [ ] Add settings page with access management
- [ ] Responsive polish (desktop-first but functional on tablet)
- [ ] Deploy to dashboard.nestyil.com

**Deliverable:** Complete dashboard deployed with all screens, GA4 integration, and live data.

### Phase 4: Nice-to-Haves (Future)

- [ ] Export to CSV/PDF for affiliate pitch decks
- [ ] Automated weekly email summary to team
- [ ] Anomaly detection (alert if signups drop >50%)
- [ ] Cohort retention matrix (retention by signup week)
- [ ] Real-time notification when new gift is purchased (Supabase Realtime)
- [ ] Custom date range presets (this week, this month, last quarter, YTD)
- [ ] Data annotations (mark events like "launched feature X" on charts)

---

## 14. SQL Queries Reference

This section provides the complete SQL for every dashboard metric, ready to be used in RPC functions or direct queries.

### 14.1 Funnel Queries

```sql
-- Stage 1: Total signups in period
SELECT COUNT(*) FROM profiles
WHERE created_at BETWEEN :start AND :end;

-- Stage 2: Completed onboarding
SELECT COUNT(*) FROM profiles
WHERE onboarding_completed = true
AND created_at BETWEEN :start AND :end;

-- Stage 3: Added at least 1 item
SELECT COUNT(DISTINCT r.owner_id)
FROM registries r
JOIN items i ON i.registry_id = r.id
WHERE r.created_at BETWEEN :start AND :end;

-- Stage 4: Added 5+ items
SELECT COUNT(DISTINCT r.owner_id)
FROM registries r
WHERE (SELECT COUNT(*) FROM items WHERE registry_id = r.id) >= 5
AND r.created_at BETWEEN :start AND :end;

-- Stage 7: Received at least 1 confirmed gift
SELECT COUNT(DISTINCT r.owner_id)
FROM registries r
JOIN items i ON i.registry_id = r.id
JOIN purchases p ON p.item_id = i.id
WHERE p.status = 'confirmed'
AND r.created_at BETWEEN :start AND :end;
```

### 14.2 Store Ranking Query

```sql
SELECT
  CASE
    WHEN original_url IS NULL OR original_url = '' THEN 'manual'
    ELSE lower(regexp_replace(
      regexp_replace(original_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    ))
  END AS store_domain,
  COUNT(*) AS item_count,
  COUNT(DISTINCT registry_id) AS registry_count,
  ROUND(AVG(price)::numeric, 2) AS avg_price,
  SUM(price * quantity) AS total_value,
  SUM(quantity_received) AS total_purchased,
  SUM(quantity) AS total_wanted,
  CASE
    WHEN SUM(quantity) > 0
    THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
    ELSE 0
  END AS purchase_rate
FROM items
WHERE price > 0
GROUP BY store_domain
ORDER BY item_count DESC
LIMIT 20;
```

### 14.3 Category Distribution Query

```sql
SELECT
  category,
  COUNT(*) AS item_count,
  ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM items)::numeric) * 100, 1) AS pct_of_total,
  SUM(price * quantity) AS total_value,
  ROUND(AVG(price)::numeric, 2) AS avg_price,
  SUM(quantity_received) AS purchased,
  SUM(quantity) AS wanted,
  CASE
    WHEN SUM(quantity) > 0
    THEN ROUND((SUM(quantity_received)::numeric / SUM(quantity)::numeric) * 100, 1)
    ELSE 0
  END AS purchase_rate
FROM items
GROUP BY category
ORDER BY item_count DESC;
```

### 14.4 Gift Giver Insights Query

```sql
-- Confirmation funnel
SELECT
  COUNT(*) AS total_purchases,
  COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'confirmed')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100,
    1
  ) AS confirmation_rate,
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 3600
    ) FILTER (WHERE status = 'confirmed'),
    1
  ) AS avg_hours_to_confirm
FROM purchases;

-- Unique gift givers
SELECT
  COUNT(DISTINCT buyer_email) AS unique_givers,
  ROUND(AVG(gifts_given)::numeric, 1) AS avg_gifts_per_giver
FROM (
  SELECT buyer_email, COUNT(*) AS gifts_given
  FROM purchases
  WHERE status = 'confirmed'
  GROUP BY buyer_email
) sub;
```

### 14.5 Pregnancy Timeline Query

```sql
-- Activity by weeks-before-due-date
SELECT
  FLOOR(EXTRACT(EPOCH FROM (p.due_date - i.created_at)) / (7 * 86400)) AS weeks_before_due,
  COUNT(*) AS items_added
FROM items i
JOIN registries r ON i.registry_id = r.id
JOIN profiles p ON r.owner_id = p.id
WHERE p.due_date IS NOT NULL
AND p.due_date > i.created_at
GROUP BY weeks_before_due
ORDER BY weeks_before_due DESC;
```

---

## 15. Open Questions & Future Considerations

### 15.1 Open Questions

| # | Question | Impact | Proposed Answer |
|---|----------|--------|-----------------|
| 1 | Should "shared" stage in funnel use GA4 data or a Supabase proxy indicator? | Funnel accuracy | Use GA4 event `registry_shared` as primary, with Supabase fallback |
| 2 | How to handle store name normalization for Hebrew entries? | Store ranking accuracy | Normalize by URL domain; group all URL-less items as "manual" |
| 3 | Should the dashboard share the same Supabase project or have a separate one? | Architecture | Same project (same data), but separate auth context via `dashboard_access` table |
| 4 | Is `pg_cron` available on the current Supabase plan? | MV refresh strategy | Check plan; if not, use Edge Function on a schedule |
| 5 | Should we track registry page views in Supabase (not just GA4)? | Funnel stage 6 accuracy | Consider adding a `registry_views` table with simple counter |

### 15.2 Future Considerations

**Affiliate Partnership Module (Phase 5+):**
When Nesty signs affiliate deals, the dashboard should expand to include:
- Partner-specific performance pages
- Click tracking (items.original_url clicks from public registry)
- Commission calculation estimates
- Coupon code usage tracking
- Revenue attribution per partner

**User Segmentation (Phase 5+):**
- Segment users by: pregnancy trimester, first-time vs. experienced parent, registry size, location (from address_city)
- Compare behavior across segments

**Automated Reports (Phase 5+):**
- Weekly email digest to team
- Monthly "State of Nesty" PDF generation
- Anomaly alerts (Slack integration)

**A/B Test Integration (Phase 6+):**
- Track feature flag experiments
- Show impact of product changes on funnel metrics

---

## Appendix A: Supabase Project Reference

| Field | Value |
|-------|-------|
| Project Ref | `wopsrjfdaovlyibivijl` |
| API URL | `https://wopsrjfdaovlyibivijl.supabase.co` |
| GTM Container | `GTM-KGM8H82F` |
| Production URL | `https://nestyil.com` (was `ppltok.github.io/Nesty`) |
| Chrome Extension ID | `mkkadfpabelceniomobeaejhlfcihkll` |

## Appendix B: Hebrew Category Translations

| Category Key | Hebrew | English |
|-------------|--------|---------|
| strollers | עגלות וטיולים | Strollers & Travel |
| car_safety | בטיחות ברכב | Car Safety |
| furniture | ריהוט | Furniture |
| safety | מוצרי בטיחות | Safety Products |
| feeding | האכלה | Feeding |
| nursing | הנקה | Nursing |
| bath | אמבט וטיפול | Bath & Care |
| clothing | ביגוד ראשוני | Newborn Clothing |
| bedding | מצעים ואקססוריז | Bedding & Accessories |
| toys | צעצועים | Toys |

## Appendix C: Store Name Normalization Map

```typescript
const STORE_ALIASES: Record<string, string> = {
  'www.shilav.co.il': 'shilav.co.il',
  'shilav.co.il': 'shilav.co.il',
  'he.aliexpress.com': 'aliexpress.com',
  'www.aliexpress.com': 'aliexpress.com',
  'aliexpress.com': 'aliexpress.com',
  'www.amazon.com': 'amazon.com',
  'amazon.com': 'amazon.com',
  'www.ksp.co.il': 'ksp.co.il',
  'ksp.co.il': 'ksp.co.il',
  'www.motzetzim.co.il': 'motzetzim.co.il',
  // Add more as discovered from data
};
```
