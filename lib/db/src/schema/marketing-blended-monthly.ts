import {
  pgTable,
  uuid,
  date,
  numeric,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Cross-channel blended marketing metrics per period.
 * One row per store × period_start.
 *
 * BLENDED CAC RECONCILIATION:
 *   blended_cac = (total_spend + overhead_content_spend) / total_new_customers
 *   overhead_content_spend captures brand/content/agency costs not attributed to
 *   a single channel — the difference between total effective spend and pure media.
 *   This reconciles channel-level CAC values with the blended figure shown in
 *   the dashboard (£12.20 April, £9.80 March — matching channel-metrics.ts mock).
 *
 * MER vs ROAS:
 *   blended_roas = total_attributed_revenue / total_spend  (pure media efficiency)
 *   blended_mer  = total_attributed_revenue / (total_spend + overhead_content_spend)
 *                 (full marketing efficiency including overhead)
 *
 * Managed by raw SQL migrations in db-migrations/migrations/.
 * drizzle-kit push is scoped to store_cost_assumptions only (see drizzle.config.ts).
 */
export const marketingBlendedMonthly = pgTable(
  "marketing_blended_monthly",
  {
    id:      uuid().defaultRandom().primaryKey().notNull(),
    storeId: uuid("store_id").notNull(),

    periodStart: date("period_start").notNull(),
    periodEnd:   date("period_end").notNull(),

    // ── Spend ──────────────────────────────────────────────────────────────────
    /** Sum of channel media/campaign spend only */
    totalSpend:               numeric("total_spend", { precision: 12, scale: 2 }).default("0").notNull(),
    /** Brand/content/agency fees not attributed to a channel */
    overheadContentSpend:     numeric("overhead_content_spend", { precision: 12, scale: 2 }).default("0").notNull(),

    // ── Revenue and orders ─────────────────────────────────────────────────────
    totalAttributedRevenue:   numeric("total_attributed_revenue", { precision: 12, scale: 2 }).default("0").notNull(),
    totalAttributedOrders:    integer("total_attributed_orders").default(0).notNull(),
    totalNewCustomers:        integer("total_new_customers").default(0).notNull(),

    // ── Blended derived metrics ────────────────────────────────────────────────
    /** (total_spend + overhead_content_spend) / total_new_customers */
    blendedCac:                       numeric("blended_cac", { precision: 10, scale: 2 }),
    /** total_attributed_revenue / total_spend (pure media) */
    blendedRoas:                      numeric("blended_roas", { precision: 10, scale: 4 }),
    /** total_attributed_revenue / (total_spend + overhead_content_spend) */
    blendedMer:                       numeric("blended_mer", { precision: 10, scale: 4 }),
    /** Weighted average CM% across all channels [0,1] */
    blendedContributionMarginPct:     numeric("blended_contribution_margin_pct", { precision: 8, scale: 4 }),
    totalContributionProfit:          numeric("total_contribution_profit", { precision: 12, scale: 2 }).default("0").notNull(),
    totalAttributedNetSales:          numeric("total_attributed_net_sales", { precision: 12, scale: 2 }).default("0").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (t) => [
    unique("mbm_unique").on(t.storeId, t.periodStart),
  ],
);

export type MarketingBlendedMonthly =
  typeof marketingBlendedMonthly.$inferSelect;
export type InsertMarketingBlendedMonthly =
  typeof marketingBlendedMonthly.$inferInsert;
