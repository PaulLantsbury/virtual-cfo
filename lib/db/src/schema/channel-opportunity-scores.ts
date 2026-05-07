import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  integer,
  timestamp,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Scored and ranked marketing improvement opportunities per channel.
 *
 * Each row represents one assessed opportunity (a channel × opportunity_type
 * combination). Multiple opportunities may exist for the same channel (e.g. Meta
 * can have both a contribution_gap and a cac_reduction opportunity).
 *
 * SCORING FORMULA:
 *   benchmark_cm_pct = 0.45
 *   gap_pct          = max(0, benchmark_cm_pct − channel.contribution_margin_pct)
 *   spend_weight     = channel.spend / total_store_spend
 *   score            = LEAST(100, round(gap_pct × spend_weight × 10000))
 *   estimated_uplift = gap_pct × channel.attributed_net_sales
 *
 * STATUS LIFECYCLE:
 *   active → monitoring (being tracked) → implemented | dismissed
 *
 * MATERIALISATION NOTE:
 *   Scores are derived from marketing_channel_monthly_snapshots using the v1 formula.
 *   When scoring logic changes, recalculate with calculation_version = 'v2'; old rows persist.
 *
 * Managed by raw SQL migrations in db-migrations/migrations/.
 * drizzle-kit push is scoped to store_cost_assumptions only (see drizzle.config.ts).
 */
export const channelOpportunityScores = pgTable(
  "channel_opportunity_scores",
  {
    id:      uuid().defaultRandom().primaryKey().notNull(),
    storeId: uuid("store_id").notNull(),

    /** Channel slug or 'blended' for cross-channel opportunities */
    channel:         text("channel").notNull(),
    assessedAt:      date("assessed_at").notNull(),
    opportunityType: text("opportunity_type").notNull(),

    // ── Scoring ────────────────────────────────────────────────────────────────
    /** 0–100; higher = bigger contribution improvement potential */
    score:               integer("score").default(0).notNull(),
    estimatedUpliftLow:  numeric("estimated_uplift_low", { precision: 12, scale: 2 }).default("0").notNull(),
    estimatedUpliftHigh: numeric("estimated_uplift_high", { precision: 12, scale: 2 }).default("0").notNull(),

    // ── Context ────────────────────────────────────────────────────────────────
    rationale: text("rationale"),
    status:    text("status").default("active").notNull(),

    /**
     * Version of the scoring formula used to compute this row.
     * Matches the calculation_version of the source monthly snapshots.
     * Increment when scoring logic changes; old rows are preserved for comparison.
     */
    calculationVersion: text("calculation_version").default("v1").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (t) => [
    check("cos_channel_check",
      sql`${t.channel} IN ('meta','google_shopping','email','organic','direct','other','blended')`),
    check("cos_type_check",
      sql`${t.opportunityType} IN ('contribution_gap','cac_reduction','budget_reallocation','roas_improvement','channel_mix')`),
    check("cos_status_check",
      sql`${t.status} IN ('active','dismissed','implemented','monitoring')`),
    check("cos_calc_version_check",
      sql`${t.calculationVersion} ~ '^v[0-9]+$'`),
  ],
);

export type ChannelOpportunityScore =
  typeof channelOpportunityScores.$inferSelect;
export type InsertChannelOpportunityScore =
  typeof channelOpportunityScores.$inferInsert;
