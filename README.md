# Nesty Dashboard

Internal analytics and business intelligence platform for the Nesty baby registry app.

---

## What Is This?

An internal dashboard that connects to Nesty's production Supabase database (and optionally Google Analytics 4) to provide real-time visibility into user engagement, conversion funnel health, registry economics, store distribution, and affiliate monetization potential.

**Live URL:** `dashboard.nestyil.com` (after deployment)
**Access:** Google Sign-In with email allowlist (internal team only)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Access to the Nesty Supabase project (`wopsrjfdaovlyibivijl.supabase.co`)
- Your email added to the `dashboard_access` table in Supabase

### 1. Clone and Install

```bash
cd nesty-dashboard
npm install
```

### 2. Environment Setup

Create `.env.local` in the `nesty-dashboard/` directory:

```env
VITE_SUPABASE_URL=https://wopsrjfdaovlyibivijl.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_GA4_PROPERTY_ID=<your-ga4-property-id>   # Optional, for GA4 integration
```

The anon key is the same one used in the main Nesty web app (`nesty-web/src/lib/supabase.ts`). It's safe to use client-side because RLS policies protect the data, and the `SECURITY DEFINER` RPC functions handle dashboard queries.

### 3. Database Setup

Before running the dashboard, you need to create the dashboard-specific tables, materialized views, and RPC functions in Supabase. Run the following SQL files in order via the Supabase SQL Editor:

```
1. sql/dashboard_access.sql          # Access control table
2. sql/materialized_views.sql        # Precomputed analytics views
3. sql/rpc_functions.sql             # Dashboard API functions
4. sql/seed_dashboard_access.sql     # Seed your admin email
```

Each file is documented with comments explaining what it creates.

### 4. Seed Your Admin Access

Edit `sql/seed_dashboard_access.sql` to include your email:

```sql
INSERT INTO dashboard_access (email, display_name, role)
VALUES ('tom@ppltok.com', 'Jack', 'admin');
```

Run this in the Supabase SQL Editor. After this, you can add more team members via the dashboard's Settings page.

### 5. Run Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5174` (port 5174 to avoid conflicting with the main Nesty app on 5173).

### 6. Sign In

1. Click "Sign in with Google"
2. Use an email that's in the `dashboard_access` table
3. You'll be redirected to the Overview page

---

## Database Schema (Dashboard-Specific)

The dashboard reads from Nesty's existing production tables and adds a few of its own:

### Tables Created by Dashboard

| Table | Purpose |
|-------|---------|
| `dashboard_access` | Email allowlist for dashboard authentication |

### Materialized Views Created by Dashboard

| View | Purpose | Refresh Rate |
|------|---------|-------------|
| `mv_daily_metrics` | Daily aggregated signups, items, gifts | Every 5 minutes |
| `mv_store_breakdown` | Store ranking by item count and value | Every 5 minutes |
| `mv_funnel_snapshot` | All-time funnel stage counts | Every 5 minutes |

### RPC Functions Created by Dashboard

| Function | Purpose | Returns |
|----------|---------|---------|
| `get_dashboard_overview(start, end)` | Top-level KPIs for a date range | JSON with 10+ metrics |
| `get_registry_economics()` | Registry value, completion, distributions | JSON with economics data |
| `get_extension_metrics()` | Extension adoption and uplift comparison | JSON with extension data |
| `get_funnel_data(start, end)` | 7-stage funnel with conversion rates | JSON array |
| `get_gift_giver_insights()` | Purchase confirmation funnel | JSON with gift metrics |
| `refresh_daily_metrics()` | Triggers MV refresh | void |

All RPC functions use `SECURITY DEFINER` to access cross-user data. They're only callable by authenticated users whose email is in `dashboard_access`.

---

## Existing Nesty Tables Used (Read-Only)

The dashboard queries these production tables but never writes to them:

| Table | Key Fields Used |
|-------|----------------|
| `profiles` | `id`, `email`, `created_at`, `onboarding_completed`, `due_date`, `is_first_time_parent` |
| `registries` | `id`, `owner_id`, `slug`, `title`, `created_at` |
| `items` | `id`, `registry_id`, `name`, `price`, `quantity`, `quantity_received`, `category`, `store_name`, `original_url`, `created_at` |
| `purchases` | `id`, `item_id`, `buyer_name`, `buyer_email`, `status`, `confirmed_at`, `is_surprise`, `gift_message`, `created_at` |
| `checklist_preferences` | `user_id`, `category_id`, `item_name`, `is_checked`, `is_hidden`, `priority` |

---

## Project Structure

```
nesty-dashboard/
├── PRD.md                    # Product Requirements Document (detailed spec)
├── README.md                 # This file
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
├── .env.local                # Local environment variables (not committed)
│
├── public/
│   └── favicon.svg
│
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Router + auth guard
│   │
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # DashboardLayout, Sidebar, Header
│   │   ├── charts/           # FunnelChart, KPICard, TrendLine, PieChart, BarChart
│   │   └── shared/           # DateRangePicker, LoadingSkeleton, EmptyState
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── OverviewPage.tsx  # Home — KPIs, mini funnel, trends
│   │   ├── FunnelPage.tsx    # 7-stage conversion funnel
│   │   ├── EconomicsPage.tsx # Registry value, completion, distributions
│   │   ├── StoresPage.tsx    # Store ranking, market share
│   │   ├── CategoriesPage.tsx# Category distribution, checklist comparison
│   │   ├── ExtensionPage.tsx # Chrome extension adoption & impact
│   │   ├── GiftsPage.tsx     # Gift giver behavior, confirmation funnel
│   │   ├── GrowthPage.tsx    # Signups, sharing, virality
│   │   ├── TimelinePage.tsx  # Pregnancy-week-based activity
│   │   └── SettingsPage.tsx  # Access management, refresh controls
│   │
│   ├── hooks/                # TanStack Query data-fetching hooks
│   ├── lib/                  # Supabase client, GA4 helper, formatters
│   ├── contexts/             # Auth + date range contexts
│   └── types/                # TypeScript interfaces
│
├── supabase/
│   ├── functions/
│   │   ├── ga4-proxy/        # Edge Function: GA4 API proxy
│   │   └── refresh-views/    # Edge Function: MV refresh on schedule
│   └── migrations/           # Optional: if using Supabase CLI
│
└── sql/
    ├── dashboard_access.sql
    ├── materialized_views.sql
    ├── rpc_functions.sql
    └── seed_dashboard_access.sql
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 19 + Vite + TypeScript | Same as Nesty web — team familiarity |
| UI | shadcn/ui + Tailwind CSS | Dashboard-ready components |
| Charts | Recharts | Lightweight, SVG, responsive |
| Data Fetching | TanStack Query v5 | Background polling, caching, real-time feel |
| Backend | Supabase (same project as Nesty) | Direct DB access, RPC functions, Auth |
| Analytics | GA4 Data API v1 (optional) | Sessions, pageviews, acquisition sources |

---

## Dashboard Screens

| Screen | What It Shows | Key Visualizations |
|--------|--------------|-------------------|
| **Overview** | CEO-level snapshot | 8 KPI cards, signup trend, mini funnel, top stores, category donut |
| **Funnel** | 7-stage conversion funnel | Funnel chart, conversion table, cohort selector |
| **Economics** | Registry value & gift economics | KPIs, value histogram, completion by category |
| **Stores** | Store distribution for partnerships | Ranking table, bar chart, market share pie |
| **Categories** | What parents buy | Dual pie charts (count + value), checklist vs. registry comparison |
| **Extension** | Chrome extension adoption | Uplift comparison table, adoption trend |
| **Gifts** | Gift giver behavior | Confirmation funnel, category distribution, gift frequency |
| **Growth** | User acquisition & virality | Signup trend, sharing methods, GA4 sources |
| **Timeline** | Activity by pregnancy week | Activity over pregnancy timeline, due date distribution |
| **Settings** | Access management | Email allowlist CRUD, refresh controls |

---

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5174)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

---

## Deployment

### GitHub Pages (Recommended)

1. Build the dashboard:
   ```bash
   npm run build
   ```

2. The output is in `dist/`. Deploy to a GitHub Pages branch or repo configured for `dashboard.nestyil.com`.

3. Configure DNS:
   - Add CNAME record: `dashboard` → `ppltok.github.io`
   - In the GitHub repo settings, set custom domain to `dashboard.nestyil.com`

4. Update `vite.config.ts` base path if needed:
   ```typescript
   base: process.env.NODE_ENV === 'production' ? '/' : '/'
   ```

### Vercel (Alternative)

```bash
npm i -g vercel
vercel --prod
```

Set environment variables in the Vercel dashboard.

---

## Google Analytics 4 Integration (Optional)

The dashboard can pull data from GA4 to supplement Supabase data (session counts, acquisition channels, page views).

### Setup

1. Go to Google Cloud Console → Enable "Google Analytics Data API"
2. Create a service account with "Viewer" role on the GA4 property
3. Download the JSON key file
4. Store the key in Supabase Vault or as an environment variable for the Edge Function
5. Deploy the `ga4-proxy` Edge Function:
   ```bash
   supabase functions deploy ga4-proxy
   ```

### What GA4 Adds

- Website session counts and trends
- User acquisition source/medium (organic, social, direct, referral)
- Custom event counts (registry_shared, registry_viewed) for funnel stages that aren't fully trackable in Supabase alone
- Page-level engagement data

---

## Materialized View Refresh

The dashboard uses materialized views for performance. These need periodic refreshing.

### Option A: pg_cron (if available on your Supabase plan)

```sql
SELECT cron.schedule(
  'refresh-dashboard-views',
  '*/5 * * * *',
  $$ SELECT refresh_daily_metrics(); $$
);
```

### Option B: Supabase Edge Function on Schedule

Deploy the `refresh-views` Edge Function and configure it to run every 5 minutes via Supabase's scheduled functions feature.

### Option C: Manual Refresh

The Settings page includes a "Refresh Data" button that calls `refresh_daily_metrics()`.

---

## Adding New Team Members

1. Go to the Settings page in the dashboard
2. Click "Add User"
3. Enter their Google email address
4. They can now sign in at `dashboard.nestyil.com`

Or via SQL:
```sql
INSERT INTO dashboard_access (email, display_name, role, added_by)
VALUES ('newperson@company.com', 'New Person', 'viewer', 'tom@ppltok.com');
```

---

## Troubleshooting

### "Access Denied" after Google sign-in
Your email is not in the `dashboard_access` table. Ask an admin to add it, or run the seed SQL.

### Data seems stale
Materialized views might not be refreshing. Go to Settings → click "Refresh Data", or check if the pg_cron job / Edge Function is running.

### Charts are empty
Check that the Supabase anon key in `.env.local` is correct and that the RPC functions exist. Run the SQL files from `sql/` in the Supabase SQL Editor.

### GA4 data not showing
GA4 integration is optional. If not configured, GA4-dependent sections will show "Not connected" with setup instructions.

---

## Documentation

- **[PRD.md](./PRD.md)** — Full product requirements document with metric definitions, screen specs, SQL queries, and architecture decisions
- **[NESTY_DATABASE_SCHEMA.md](../NESTY_DATABASE_SCHEMA.md)** — Complete Nesty production database schema
- **[CLAUDE.md](../CLAUDE.md)** — Nesty project overview and developer guide
