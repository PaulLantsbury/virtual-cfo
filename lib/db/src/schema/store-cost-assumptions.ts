import { pgTable, uuid, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Cost rate assumptions used to compute contribution_margin_pct() and related RPCs.
 * One row per store per effective period; the most-recent row effective at or before
 * a query's period_start is used (point-in-time rate lookup).
 *
 * Column types and precision/scale match the live PostgreSQL schema exactly so that
 * drizzle-kit push detects no drift and proposes no ALTER statements.
 * Precision/scale values were verified via drizzle-kit pull against the live DB.
 *
 * Managed by raw SQL migrations in db-migrations/migrations/.
 * drizzle-kit push is scoped to this table only via tablesFilter in drizzle.config.ts.
 */
export const storeCostAssumptions = pgTable("store_cost_assumptions", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  storeId: uuid("store_id").notNull(),

  // ── Rate-based deductions (% of net_sales or return_amount) ───────────────
  /** Payment processing fee as a proportion of net_sales (e.g. 0.029 = 2.9%). precision(8,5) matches live column. */
  paymentFeeRate: numeric("payment_fee_rate", { precision: 8, scale: 5 }).notNull(),
  /** Rate of return_amount to deduct as return handling cost (e.g. 0.15 = 15%). precision(8,5) matches live column. */
  returnHandlingRate: numeric("return_handling_rate", { precision: 8, scale: 5 }).notNull(),
  /** VAT rate — stored for reference; NOT deducted in CM formula (VAT excluded from net_sales). */
  vatRate: numeric("vat_rate").default("0.20").notNull(),
  /**
   * Variable performance marketing spend as a proportion of gross_revenue.
   * Proxy for Meta + Google ad spend until live ad-platform data is available.
   * Added in migration 20260504000002. DEFAULT 0 for backward compatibility.
   * @future Replace with sum of monthly_ad_spend rows when that table exists.
   */
  marketingSpendRate: numeric("marketing_spend_rate").default("0").notNull(),

  // ── Per-order deductions (£/order) ────────────────────────────────────────
  /** Third-party fulfilment cost per shipped order (£). precision(10,2) matches live column. */
  fulfilmentCostPerOrder: numeric("fulfilment_cost_per_order", { precision: 10, scale: 2 }).notNull(),
  /** Packaging materials cost per order (£). precision(10,2) matches live column. */
  packagingCostPerOrder: numeric("packaging_cost_per_order", { precision: 10, scale: 2 }).notNull(),
  /**
   * Carrier / last-mile shipping cost per order (£).
   * Added in migration 20260504000002. DEFAULT 0 for backward compatibility.
   */
  shippingCostPerOrder: numeric("shipping_cost_per_order").default("0").notNull(),

  // ── Period ─────────────────────────────────────────────────────────────────
  /** First day of the period these rates apply from (inclusive). */
  effectiveFrom: date("effective_from").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const insertStoreCostAssumptionsSchema = createInsertSchema(
  storeCostAssumptions,
).omit({ id: true, createdAt: true });

export type InsertStoreCostAssumptions = z.infer<
  typeof insertStoreCostAssumptionsSchema
>;
export type StoreCostAssumptions = typeof storeCostAssumptions.$inferSelect;
