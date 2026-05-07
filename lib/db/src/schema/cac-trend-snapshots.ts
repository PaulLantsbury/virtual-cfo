import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  integer,
  timestamp,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Point-in-time CAC snapshots per channel for trend analysis.
 * One row per store × channel × snapshot_date (end of period).
 *
 * Tracks both the period CAC and trailing averages to support:
 * - Month-on-month CAC trend charts (Growth Quality, Marketing Efficiency pages)
 * - Trailing 90-day CAC benchmarks
 * - MoM change % for alerts (e.g. Meta CAC +14% MoM triggers alert)
 *
 * Seeded for March 2026 (prev) and April 2026 (current):
 *   Meta: £16.14 → £18.40 (+14%) — matches CAC_BY_CHANNEL mock changeLabel "+14%"
 *   Google: £10.57 → £11.20 (+6%) — matches "+6%"
 *   Email: £4.90 → £4.80 (−2%) — matches "−2%"
 *   Organic: £2.10 → £2.10 (0%) — matches "Stable"
 *
 * Managed by raw SQL migrations in db-migrations/migrations/.
 * drizzle-kit push is scoped to store_cost_assumptions only (see drizzle.config.ts).
 */
export const cacTrendSnapshots = pgTable(
  "cac_trend_snapshots",
  {
    id:      uuid().defaultRandom().primaryKey().notNull(),
    storeId: uuid("store_id").notNull(),

    /** Channel slug. Must match CHECK constraint in DB. */
    channel:      text("channel").notNull(),
    /** Last day of the period this snapshot represents */
    snapshotDate: date("snapshot_date").notNull(),

    // ── CAC values ─────────────────────────────────────────────────────────────
    /** Period CAC: spend / attributed_new_customers */
    cac:             numeric("cac", { precision: 10, scale: 2 }).notNull(),
    /** 30-day rolling average CAC */
    trailing30dCac:  numeric("trailing_30d_cac", { precision: 10, scale: 2 }),
    /** 90-day rolling average CAC */
    trailing90dCac:  numeric("trailing_90d_cac", { precision: 10, scale: 2 }),

    // ── Context ────────────────────────────────────────────────────────────────
    /** Month-on-month change as a decimal ratio (e.g. 0.14 = +14%). Null for first seeded period. */
    momChangePct:            numeric("mom_change_pct", { precision: 8, scale: 4 }),
    attributedNewCustomers:  integer("attributed_new_customers").default(0).notNull(),
    spend:                   numeric("spend", { precision: 12, scale: 2 }).default("0").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (t) => [
    unique("cts_unique").on(t.storeId, t.channel, t.snapshotDate),
    check("cts_channel_check",
      sql`${t.channel} IN ('meta','google_shopping','email','organic','direct','other')`),
  ],
);

export type CacTrendSnapshot =
  typeof cacTrendSnapshots.$inferSelect;
export type InsertCacTrendSnapshot =
  typeof cacTrendSnapshots.$inferInsert;
