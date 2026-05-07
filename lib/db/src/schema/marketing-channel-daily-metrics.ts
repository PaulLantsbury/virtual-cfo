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
 * Raw daily marketing metrics per channel.
 * One row per store × channel × day.
 *
 * This is the atomic input layer. In production, rows are written by platform
 * ingestion jobs (Meta Ads API, Google Ads API). For development, aggregate
 * seed rows (one per channel per month) are inserted via migration
 * 20260507000002_marketing_intelligence_schema.sql.
 *
 * UNIQUE constraint: (store_id, channel, metric_date) — enforced at DB level.
 * Managed by raw SQL migrations in db-migrations/migrations/.
 * drizzle-kit push is scoped to store_cost_assumptions only (see drizzle.config.ts).
 */
export const marketingChannelDailyMetrics = pgTable(
  "marketing_channel_daily_metrics",
  {
    id:      uuid().defaultRandom().primaryKey().notNull(),
    storeId: uuid("store_id").notNull(),

    /** Channel slug. Must match CHECK constraint in DB. */
    channel:    text("channel").notNull(),
    metricDate: date("metric_date").notNull(),

    // ── Spend and media metrics ────────────────────────────────────────────────
    spend:       numeric("spend", { precision: 12, scale: 2 }).default("0").notNull(),
    impressions: bigint("impressions", { mode: "number" }).default(0).notNull(),
    clicks:      bigint("clicks", { mode: "number" }).default(0).notNull(),
    sessions:    bigint("sessions", { mode: "number" }).default(0).notNull(),

    // ── Attribution ───────────────────────────────────────────────────────────
    attributedOrders:        integer("attributed_orders").default(0).notNull(),
    attributedNewCustomers:  integer("attributed_new_customers").default(0).notNull(),
    attributedGrossSales:    numeric("attributed_gross_sales", { precision: 12, scale: 2 }).default("0").notNull(),

    // ── Cost deductions on attributed orders ──────────────────────────────────
    discountImpact:          numeric("discount_impact", { precision: 12, scale: 2 }).default("0").notNull(),
    returnsImpact:           numeric("returns_impact", { precision: 12, scale: 2 }).default("0").notNull(),
    shippingSubsidyImpact:   numeric("shipping_subsidy_impact", { precision: 12, scale: 2 }).default("0").notNull(),

    // ── Data provenance ───────────────────────────────────────────────────────
    dataSource: text("data_source").default("estimated").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (t) => [
    unique("mcdm_unique").on(t.storeId, t.channel, t.metricDate),
    check("mcdm_channel_check",
      sql`${t.channel} IN ('meta','google_shopping','email','organic','direct','other')`),
    check("mcdm_source_check",
      sql`${t.dataSource} IN ('meta_api','google_api','manual','estimated','shopify')`),
  ],
);

export type MarketingChannelDailyMetrics =
  typeof marketingChannelDailyMetrics.$inferSelect;
export type InsertMarketingChannelDailyMetrics =
  typeof marketingChannelDailyMetrics.$inferInsert;
