/**
 * Centralised mock data for the Virtual CFO app.
 *
 * This module holds benchmark ranges, shared opportunity objects and the
 * action library. Each structure is designed to be replaced with live
 * data when the Shopify / accounting integrations are connected.
 *
 * @module mock-data
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BenchmarkStatus = "Above range" | "In range" | "Below range" | "Watch";
export type OpportunityCategory = "Pricing" | "Marketing" | "Cash" | "Margin" | "Operations" | "Retention";
export type ConfidenceLevel = "High" | "Medium-High" | "Medium" | "Low";
export type EffortLevel = "Low" | "Medium" | "High";
export type TimingHorizon = "Immediate" | "1–2 weeks" | "2–4 weeks" | "30 days" | "30–90 days" | "6 months";

// ─── Benchmark context model ───────────────────────────────────────────────────

export interface Benchmark {
  metric:        string;
  unit:          string;
  /** Floor — below this is critical */
  lowerBound:    number;
  /** Typical healthy DTC range */
  typicalLow:    number;
  typicalHigh:   number;
  /** Top-quartile performance */
  topQuartile:   number;
  /** Current business value */
  currentValue:  number;
  status:        BenchmarkStatus;
}

export const BENCHMARKS: Record<string, Benchmark> = {
  contributionMargin: {
    metric:       "Contribution Margin",
    unit:         "%",
    lowerBound:   35,
    typicalLow:   45,
    typicalHigh:  60,
    topQuartile:  65,
    currentValue: 42.3,
    status:       "Below range",
  },
  repeatPurchaseRate: {
    metric:       "Repeat Purchase Rate",
    unit:         "%",
    lowerBound:   20,
    typicalLow:   25,
    typicalHigh:  40,
    topQuartile:  50,
    currentValue: 28,
    status:       "In range",
  },
  discountDependency: {
    metric:       "Discount Dependency",
    unit:         "%",
    lowerBound:   10,
    typicalLow:   15,
    typicalHigh:  25,
    topQuartile:  12,
    currentValue: 38,
    status:       "Above range",
  },
  cacPayback: {
    metric:       "CAC Payback",
    unit:         "orders",
    lowerBound:   0.5,
    typicalLow:   0.8,
    typicalHigh:  1.2,
    topQuartile:  0.6,
    currentValue: 1.4,
    status:       "Above range",
  },
  returnRate: {
    metric:       "Return Rate",
    unit:         "%",
    lowerBound:   5,
    typicalLow:   8,
    typicalHigh:  18,
    topQuartile:  6,
    currentValue: 12,
    status:       "In range",
  },
  cashRunway: {
    metric:       "Cash Runway",
    unit:         "months",
    lowerBound:   2,
    typicalLow:   3,
    typicalHigh:  6,
    topQuartile:  9,
    currentValue: 3.4,
    status:       "Watch",
  },
  workingCapitalDrag: {
    metric:       "Working Capital Drag",
    unit:         "£",
    lowerBound:   0,
    typicalLow:   40_000,
    typicalHigh:  80_000,
    topQuartile:  20_000,
    currentValue: 74_000,
    status:       "Watch",
  },
};

// ─── Shared Opportunity object structure ──────────────────────────────────────

export interface SharedOpportunity {
  id:                string;
  title:             string;
  category:          OpportunityCategory;
  driverMetric:      string;
  monthlyImpactLow:  number;
  monthlyImpactHigh: number;
  /** 0 for one-off cash releases */
  annualImpact:      number;
  confidence:        ConfidenceLevel;
  effort:            EffortLevel;
  timing:            TimingHorizon;
  priorityRank:      number;
  linkedPage:        string;
  linkedPageLabel:   string;
  recommendedAction: string;
  impactType:        "monthly_contribution" | "cash_improvement";
  dependencies?:     string[];
}

export const SHARED_OPPORTUNITIES: SharedOpportunity[] = [
  {
    id:                "opp-a",
    title:             "Reduce average discount depth",
    category:          "Pricing",
    driverMetric:      "Discount dependency 38% — above preferred 15–25%",
    monthlyImpactLow:  12_000,
    monthlyImpactHigh: 18_000,
    annualImpact:      180_000,
    confidence:        "High",
    effort:            "Low",
    timing:            "Immediate",
    priorityRank:      1,
    linkedPage:        "/pricing-optimisation",
    linkedPageLabel:   "Pricing Optimisation",
    recommendedAction: "Reduce average discount from 18% to 15% by removing automatic repeat-customer discounts. Returning buyers have demonstrated intent — discounting them is pure margin loss.",
    impactType:        "monthly_contribution",
  },
  {
    id:                "opp-b",
    title:             "Reallocate inefficient Meta spend",
    category:          "Marketing",
    driverMetric:      "Meta CAC +14% — £28 vs £24 prior month",
    monthlyImpactLow:  6_000,
    monthlyImpactHigh: 10_000,
    annualImpact:      96_000,
    confidence:        "Medium",
    effort:            "Low",
    timing:            "1–2 weeks",
    priorityRank:      2,
    linkedPage:        "/marketing-efficiency",
    linkedPageLabel:   "Marketing Efficiency",
    recommendedAction: "Shift 15% of Meta budget to email and organic. Meta CAC (£28) runs 5.8× higher than email CAC (£4.80) — the same spend generates significantly more profitable customers through email.",
    impactType:        "monthly_contribution",
  },
  {
    id:                "opp-c",
    title:             "Reduce shipping cost per order",
    category:          "Margin",
    driverMetric:      "Shipping costs up 12% per order vs prior period",
    monthlyImpactLow:  5_000,
    monthlyImpactHigh: 7_000,
    annualImpact:      72_000,
    confidence:        "High",
    effort:            "Medium",
    timing:            "2–4 weeks",
    priorityRank:      3,
    linkedPage:        "/margin-analysis",
    linkedPageLabel:   "Margin Analysis",
    recommendedAction: "Renegotiate rates with current carrier or introduce a minimum order threshold for free shipping. At current volume, a 10% reduction in shipping cost adds £3.70 per order to contribution.",
    impactType:        "monthly_contribution",
  },
  {
    id:                "opp-d",
    title:             "Reduce inventory days",
    category:          "Cash",
    driverMetric:      "Inventory days 82 — above typical 45–60 days",
    monthlyImpactLow:  40_000,
    monthlyImpactHigh: 60_000,
    annualImpact:      0,
    confidence:        "Medium",
    effort:            "Medium",
    timing:            "30–90 days",
    priorityRank:      4,
    linkedPage:        "/cash-control",
    linkedPageLabel:   "Cash Control",
    recommendedAction: "Reduce inventory days from 82 to 60 by tightening replenishment rules and clearing slow-moving SKUs. Each 10-day reduction frees approximately £14k in working capital.",
    impactType:        "cash_improvement",
    dependencies:      ["Clear aged stock lines", "Update reorder rules"],
  },
  {
    id:                "opp-e",
    title:             "Improve full-price order ratio",
    category:          "Pricing",
    driverMetric:      "Full-price order ratio declining — 38% of orders now discounted",
    monthlyImpactLow:  8_000,
    monthlyImpactHigh: 14_000,
    annualImpact:      132_000,
    confidence:        "Medium",
    effort:            "Medium",
    timing:            "30 days",
    priorityRank:      5,
    linkedPage:        "/pricing-optimisation",
    linkedPageLabel:   "Pricing Optimisation",
    recommendedAction: "Segment promotions by customer lifecycle stage. Remove blanket discounts for repeat buyers and reserve offers for re-engagement campaigns only.",
    impactType:        "monthly_contribution",
  },
];

// ─── Action library ───────────────────────────────────────────────────────────

export interface LibraryAction {
  id:                  string;
  title:               string;
  category:            OpportunityCategory;
  triggerMetric:       string;
  triggerCondition:    string;
  expectedImpactLow:   number;
  expectedImpactHigh:  number;
  confidenceWeight:    ConfidenceLevel;
  effort:              EffortLevel;
  timing:              TimingHorizon;
  recommendedOwner:    string;
  linkedOpportunityId?: string;
}

export const ACTION_LIBRARY: LibraryAction[] = [
  {
    id:                  "act-1",
    title:               "Reduce discounting by 3pp",
    category:            "Pricing",
    triggerMetric:       "Discount dependency",
    triggerCondition:    "Discount rate > 25%",
    expectedImpactLow:   10_000,
    expectedImpactHigh:  18_000,
    confidenceWeight:    "High",
    effort:              "Low",
    timing:              "Immediate",
    recommendedOwner:    "Commercial / Ecommerce Lead",
    linkedOpportunityId: "opp-a",
  },
  {
    id:                  "act-2",
    title:               "Reallocate 15% of Meta spend to Email / Organic",
    category:            "Marketing",
    triggerMetric:       "Meta CAC",
    triggerCondition:    "Meta CAC > 1.3× email CAC",
    expectedImpactLow:   6_000,
    expectedImpactHigh:  10_000,
    confidenceWeight:    "Medium",
    effort:              "Low",
    timing:              "1–2 weeks",
    recommendedOwner:    "Paid Media / Growth Lead",
    linkedOpportunityId: "opp-b",
  },
  {
    id:                  "act-3",
    title:               "Renegotiate shipping provider rates",
    category:            "Margin",
    triggerMetric:       "Shipping cost per order",
    triggerCondition:    "Shipping cost > £5 per order",
    expectedImpactLow:   5_000,
    expectedImpactHigh:  7_000,
    confidenceWeight:    "High",
    effort:              "Medium",
    timing:              "2–4 weeks",
    recommendedOwner:    "Operations / Supply Chain Lead",
    linkedOpportunityId: "opp-c",
  },
  {
    id:                  "act-4",
    title:               "Reduce inventory days by 12",
    category:            "Cash",
    triggerMetric:       "Inventory days",
    triggerCondition:    "Inventory days > 60",
    expectedImpactLow:   40_000,
    expectedImpactHigh:  60_000,
    confidenceWeight:    "Medium",
    effort:              "Medium",
    timing:              "30–90 days",
    recommendedOwner:    "Supply Chain / Finance Lead",
    linkedOpportunityId: "opp-d",
  },
  {
    id:                  "act-5",
    title:               "Hold fixed costs flat for 90 days",
    category:            "Operations",
    triggerMetric:       "Contribution Margin",
    triggerCondition:    "Contribution margin < 45%",
    expectedImpactLow:   8_000,
    expectedImpactHigh:  15_000,
    confidenceWeight:    "High",
    effort:              "Low",
    timing:              "Immediate",
    recommendedOwner:    "Finance / CEO",
  },
  {
    id:                  "act-6",
    title:               "Improve full-price order mix",
    category:            "Pricing",
    triggerMetric:       "Full-price order ratio",
    triggerCondition:    "Discounted order ratio > 30%",
    expectedImpactLow:   8_000,
    expectedImpactHigh:  14_000,
    confidenceWeight:    "Medium",
    effort:              "Medium",
    timing:              "30 days",
    recommendedOwner:    "Ecommerce / CRM Lead",
    linkedOpportunityId: "opp-e",
  },
];
