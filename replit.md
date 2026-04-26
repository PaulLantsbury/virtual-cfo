# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── virtual-cfo/        # Virtual CFO SaaS dashboard (React + Vite)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Virtual CFO SaaS Dashboard

**Artifact:** `artifacts/virtual-cfo` (`@workspace/virtual-cfo`)

A modern SaaS financial dashboard for founders and operators.

### Routes
- `/` — Landing page (marketing, hero, features, CTA)
- `/login` — Login page with Supabase scaffolding
- `/dashboard` — Main dashboard with KPI cards, CFO insight, top drivers, action recommendations
- `/margin-analysis` — Contribution margin breakdown by channel, discount impact, returns analysis
- `/growth-quality` — Repeat rate, CAC payback, discount dependency, growth quality score
- `/marketing-efficiency` — Channel CAC, blended efficiency, acquisition diagnostics
- `/opportunities` — Ranked profit opportunities with phased execution plan (Do now / Next wave)
- `/profit-engine` — EBITDA bridge, break-even analysis, profit sensitivity simulator, driver attribution
- `/settings` — Settings page
- `/upgrade` — Plan upgrade page

### Layout
- Reusable `AppLayout` component: dark sidebar + top header
- Sidebar: Dashboard, Transactions, Reports, Settings, Help & Support
- Header: search bar, notifications, user avatar

### Dashboard KPIs (from API)
- Monthly Revenue, Monthly Expenses, Net Profit, Cash Runway
- Cash Flow line chart (Recharts)
- Net Profit Margin bar chart (Recharts)
- Recent transactions table

### Plan Gating System
- `src/lib/plan.ts` — `canAccess(featureName)` returns true for the current user's plan
- Plan tiers: `"free"` | `"pro"` (default: free; override via `sessionStorage.setItem("userPlan", "pro")`)
- Feature registry: `opportunity_breakdown`, `channel_margin_analysis`, `cac_payback`, `margin_bridge`, `driver_breakdown`, `fastest_recovery_lever`, `ai_cfo_action_plans` (Pro only)

### AI CFO Interaction Layer
Present on all 9 main pages. Consists of three components + one data file:

- **`src/lib/aiCfoResponses.ts`** — Mock AI responses keyed by page ID (`dashboard`, `margin`, `growth`, `marketing`, `pricing`, `profit`, `cash`, `opportunities`, `scenario`). Each entry has: `question`, `verdict`, `evidence[]`, `recommendedAction`, `expectedImpact`, `confidence`.
- **`src/components/AiCfoProvider.tsx`** — React context (`useAiCfo()`) exposing `openDrawer(pageId)`. Wraps the app at root level.
- **`src/components/AiCfoDrawer.tsx`** — Slide-in right panel. Free users see verdict + first 2 evidence bullets + upgrade CTA. Pro users see full evidence + `recommendedAction` + `expectedImpact`.
- **`src/components/AiCfoAskCard.tsx`** — Inline trigger card showing the page question and "Get Analysis" button with 1.5s loading state. Inserted into every page just before the first major data section.

The `AiCfoProvider` and `AiCfoDrawer` are mounted at app root in `App.tsx` (inside `TimelineProvider`). Each page imports and renders `<AiCfoAskCard pageId="..." />` at the appropriate location.

### Reusable Pro-Gating Components
- **`UpgradePreviewCard`** — indigo inline card with lock icon + CTA link to `/upgrade`. Used for compact in-section upgrade prompts.
- **`PremiumBlurPreview`** — full-section blur wrapper. Accepts `title`, `subtitle`, `headerExtra`, `badgeText`, `ctaTitle`, `ctaDescription`, `ctaText`, `isPro`, and `children`. When `isPro=false`: blurs children with `blur-[3px] opacity-40`, applies a gradient fade from bottom, and renders an indigo upgrade card. When `isPro=true`: renders children normally with optional `headerExtra` in the header. Used for chart/table sections — pass `canAccess("feature")` as `isPro`.

### Supabase Integration
- Scaffolded in `artifacts/virtual-cfo/src/lib/supabase.ts`
- Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- Copy `.env.example` to `.env` and fill in Supabase credentials to activate

### Environment Variables
See `artifacts/virtual-cfo/.env.example` for required env vars.

### Tech
- React + Vite + TypeScript
- TailwindCSS v4
- Recharts for data visualization
- React Query for data fetching
- Framer Motion for animations
- `@supabase/supabase-js` for auth scaffolding

## API Server

**Artifact:** `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers
  - `src/routes/health.ts` — `GET /api/healthz`
  - `src/routes/dashboard.ts` — `GET /api/dashboard/kpis`, `/api/dashboard/revenue-chart`, `/api/dashboard/transactions`
- Depends on: `@workspace/db`, `@workspace/api-zod`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`).

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.
