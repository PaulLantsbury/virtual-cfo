import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  bigint,
  integer,
  timestamp,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Pre-computed monthly marketing performance snapshots per channel.
 * One row per store × channel × period_start.
 *
 * These are what the app queries — never the raw daily metrics table.
 * Populated by the refresh_channel_monthly_snapshots() utility function or
 * nightly ingestion jobs in production.
 *
 * CONTRIBUTION-FIRST METRICS (all pre-computed and stored):
 *   attributed_net_sales     = attributed_gross_sales − discount_impact − returns_impact
 *   contribution_profit      = attributed_net_sales × contribution_margin_pct
 *   contribution_margin_pct  = contribution_profit / attributed_net_sales  [0,1]
 *
 * CAC VALUES (stored as pre-computed; match channel-metrics.ts mock values):
 *   Meta April £18.40 (+14% MoM), Google £11.20 (+6%), Email £4.80 (−2%), Organic £2.10 (stable)
 *
 * MATERIALISATION NOTE:
 *   This table is a pre-computed snapshot derived from marketing_channel_daily_metrics.
 *   The raw daily table is the canonical source; all derived fields here (contribution_profit,
 *   cac, roas, etc.) are analytical calculations. When formulas change, increment
 *   calculation_version (v1 → v2) rather than overwriting rows. Old versions are preserved.
 *
 * Managed by raw SQL migrations in db-migrations/migrations/.
 * drizzle-kit push is scoped to store_cost_assumptions only (see drizzle.config.ts).
 */
export const marketingChannelMonthlySnapshots = pgTable(
  "marketing_channel_monthly_snapshots",
  {
    id:      uuid().defaultRandom().primaryKey().notNull(),
    storeId: uuid("store_id").notNull(),

    /** Channel slug. Must match CHECK constraint in DB. */
    channel:     text("channel").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd:   date("period_end").notNull(),

    // ── Raw aggregates ─────────────────────────────────────────────────────────
    spend:                   numeric("spend", { precision: 12, scale: 2 }).default("0").notNull(),
    impressions:             bigint("impressions", { mode: "number" }).default(0).notNull(),
    clicks:                  bigint("clicks", { mode: "number" }).default(0).notNull(),
    sessions:                bigint("sessions", { mode: "number" }).default(0).notNull(),
    attributedOrders:        integer("attributed_orders").default(0).notNull(),
    attributedNewCustomers:  integer("attributed_new_customers").default(0).notNull(),
    attributedGrossSales:    numeric("attributed_gross_sales", { precision: 12, scale: 2 }).default("0").notNull(),

    // ── Deductions ─────────────────────────────────────────────────────────────
    discountImpact:          numeric("discount_impact", { precision: 12, scale: 2 }).default("0").notNull(),
    returnsImpact:           numeric("returns_impact", { precision: 12, scale: 2 }).default("0").notNull(),
    shippingSubsidyImpact:   numeric("shipping_subsidy_impact", { precision: 12, scale: 2 }).default("0").notNull(),

    // ── Contribution-first derived metrics ────────────────────────────────────
    /** attributed_gross_sales − discount_impact − returns_impact */
    attributedNetSales:      numeric("attributed_net_sales", { precision: 12, scale: 2 }).default("0").notNull(),
    /** attributedNetSales × contribution_margin_pct */
    contributionProfit:      numeric("contribution_profit", { precision: 12, scale: 2 }).default("0").notNull(),
    /** [0,1] ratio — matches format of contribution_margin_pct() RPC */
    contributionMarginPct:   numeric("contribution_margin_pct", { precision: 8, scale: 4 }).default("0").notNull(),

    // ── Efficiency metrics ─────────────────────────────────────────────────────
    /** spend / attributed_new_customers (£ per new customer) */
    cac:                numeric("cac", { precision: 10, scale: 2 }),
    /** attributed_gross_sales / spend (revenue per £ of ad spend) */
    roas:               numeric("roas", { precision: 10, scale: 4 }),
    /** attributed_gross_sales / total_store_spend (blended efficiency ratio) */
    mer:                numeric("mer", { precision: 10, scale: 4 }),
    /** cac / (contribution_profit / attributed_orders) — orders to recover acquisition cost */
    cacPaybackOrders:   numeric("cac_payback_orders", { precision: 8, scale: 4 }),

    // ── Opportunity scoring ────────────────────────────────────────────────────
    /** 0–100; higher = greater contribution improvement potential */
    opportunityScore:  integer("opportunity_score").default(0).notNull(),

    /** 'live' | 'estimated' | 'stale' */
    dataFreshness: text("data_freshness").default("estimated").notNull(),
    /**
     * Version of the contribution/attribution formula used to compute derived fields.
     * Increment (v1 → v2) when recalculating with updated logic; old rows are preserved.
     * Convention: 'v{integer}' — e.g. 'v1', 'v2'.
     */
    calculationVersion: text("calculation_version").default("v1").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (t) => [
    unique("mcms_unique").on(t.storeId, t.channel, t.periodStart),
    check("mcms_channel_check",
      sql`${t.channel} IN ('meta','google_shopping','email','organic','direct','other')`),
    check("mcms_freshness_check",
      sql`${t.dataFreshness} IN ('live','estimated','stale')`),
    check("mcms_calc_version_check",
      sql`${t.calculationVersion} ~ '^v[0-9]+$'`),
  ],
);

export type MarketingChannelMonthlySnapshot =
  typeof marketingChannelMonthlySnapshots.$inferSelect;
export type InsertMarketingChannelMonthlySnapshot =
  typeof marketingChannelMonthlySnapshots.$inferInsert;
