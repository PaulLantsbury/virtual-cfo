import { useActiveStore } from "@/lib/auth/AuthProvider";
import { useState } from "react";
import { Lock, SlidersHorizontal, Shield } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { canAccess } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { TimelineSelector } from "@/components/TimelineSelector";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { PeriodImpact } from "@/components/PeriodImpact";
import { MONTHLY_CM_PCT } from "@/lib/data/business-snapshot";
import { CHANNEL_CM_PCT } from "@/lib/data/channel-metrics";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";

const TREND_DATA = [
  { month: "Mar '25", margin: 48.2, highlighted: true },
  { month: "Apr", margin: 47.8 },
  { month: "May", margin: 48.0 },
  { month: "Jun", margin: 47.5 },
  { month: "Jul", margin: 48.1 },
  { month: "Aug", margin: 47.9 },
  { month: "Sep", margin: 47.4 },
  { month: "Oct", margin: 47.1 },
  { month: "Nov", margin: 46.3 },
  { month: "Dec", margin: 45.8 },
  { month: "Jan", margin: 44.9 },
  { month: "Feb", margin: 43.7 },
  { month: "Mar '26", margin: 42.3, highlighted: true },
];

const BRIDGE_ROWS: Array<{
  label: string;
  total: number;
  perOrder: number;
  type: "revenue" | "deduction";
  trend: "stable" | "worsening" | "improving";
}> = [
  {
    label: "Revenue",
    total: 124500,
    perOrder: 68.4,
    type: "revenue",
    trend: "stable",
  },
  {
    label: "Discounts",
    total: -8715,
    perOrder: -8.1,
    type: "deduction",
    trend: "worsening",
  },
  {
    label: "Payment fees",
    total: -2490,
    perOrder: -1.9,
    type: "deduction",
    trend: "stable",
  },
  {
    label: "Shipping costs",
    total: -15562,
    perOrder: -4.8,
    type: "deduction",
    trend: "worsening",
  },
  {
    label: "Fulfilment costs",
    total: -17430,
    perOrder: -6.4,
    type: "deduction",
    trend: "stable",
  },
  {
    label: "Marketing spend",
    total: -27390,
    perOrder: -12.2,
    type: "deduction",
    trend: "worsening",
  },
];

const RECOVERY_SCENARIOS = [
  {
    shortLabel: "Reallocate Meta spend",
    action: "Reduce Meta CAC by 10%",
    detail:
      "Example: explore a channel-budget change under assumed channel economics",
    ppGain: 1.4,
    newCm: 43.7,
    cashImpact: 9_500,
    confidence: "medium" as const,
    effort: "low" as const,
    timeframe: "1–2 weeks",
  },
  {
    shortLabel: "Reduce shipping costs",
    action: "Reduce shipping costs by 8%",
    detail:
      "Example: explore lower carrier rates; feasibility has not been assessed",
    ppGain: 1.0,
    newCm: 43.3,
    cashImpact: 6_800,
    confidence: "high" as const,
    effort: "medium" as const,
    timeframe: "2–4 weeks",
  },
  {
    shortLabel: "Lower discount depth",
    action: "Reduce discount depth to 5%",
    detail:
      "Example: explore a different discount approach; outcomes are not predicted",
    ppGain: 0.6,
    newCm: 42.9,
    cashImpact: 4_100,
    confidence: "high" as const,
    effort: "low" as const,
    timeframe: "Immediate",
  },
];

const OPPORTUNITY_LEAK_COPY: Record<string, string> = {
  "Reallocate Meta spend":
    "Sample acquisition cost pressure; not an observed business result.",
  "Reduce shipping costs": "Sample carrier and fulfilment cost pressure.",
  "Lower discount depth":
    "Sample discount pressure; not an observed business result.",
};

const OPPORTUNITY_LEAK_TITLES: Record<string, string> = {
  "Reallocate Meta spend": "Sample acquisition cost increase",
  "Reduce shipping costs": "Sample shipping cost increase",
  "Lower discount depth": "Sample discount impact",
};

const UNIT_ECON_HISTORY = [
  { month: "Mar '25", revenue: 71.8, contribution: 40.5, highlighted: true },
  { month: "Apr", revenue: 71.2, contribution: 39.1 },
  { month: "May", revenue: 70.8, contribution: 38.6 },
  { month: "Jun", revenue: 69.5, contribution: 38.0 },
  { month: "Jul", revenue: 72.1, contribution: 40.2 },
  { month: "Aug", revenue: 73.4, contribution: 41.5 },
  { month: "Sep", revenue: 71.9, contribution: 40.8 },
  { month: "Oct", revenue: 70.6, contribution: 39.4 },
  { month: "Nov", revenue: 69.8, contribution: 38.9 },
  { month: "Dec", revenue: 71.3, contribution: 38.2 },
  { month: "Jan", revenue: 69.1, contribution: 37.0 },
  { month: "Feb", revenue: 68.7, contribution: 36.1 },
  { month: "Mar '26", revenue: 68.4, contribution: 35.0, highlighted: true },
];

const CHANNELS = [
  { name: "Meta", cm: CHANNEL_CM_PCT.meta, revenue: 41800 },
  {
    name: "Google Shopping",
    cm: CHANNEL_CM_PCT.googleShopping,
    revenue: 28600,
  },
  { name: "Email", cm: CHANNEL_CM_PCT.email, revenue: 22100 },
  { name: "Organic", cm: CHANNEL_CM_PCT.organic, revenue: 32000 },
];

const CHANGE_DRIVERS = [
  {
    driver: "Shipping costs",
    change: "+8%",
    impactPerOrder: -2.1,
    direction: "negative" as const,
  },
  {
    driver: "Discount depth",
    change: "+1.8pp",
    impactPerOrder: -1.8,
    direction: "negative" as const,
  },
  {
    driver: "Meta CAC",
    change: "+14%",
    impactPerOrder: -3.4,
    direction: "negative" as const,
  },
  {
    driver: "Payment processing rate",
    change: "+0.3%",
    impactPerOrder: -0.2,
    direction: "negative" as const,
  },
  {
    driver: "Returns rate",
    change: "+2.1%",
    impactPerOrder: -1.4,
    direction: "negative" as const,
  },
];

const SIM_ORDERS = 1_512;

// Fixed prototype multipliers; not calibrated to source costs or validated.
const SIM_MULTIPLIERS = {
  metaPerPct: 633, // −1% Meta CAC → +£633 contribution
  shippingPerPct: 340, // −1% shipping → +£340 contribution
  discountPerPp: 820, // −1pp discount depth → +£820 contribution
  returnsPerPp: 540, // −1pp returns rate → +£540 contribution
  paymentPerPp: 450, // −1pp payment rate → +£450 contribution
} as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarginAnalysis() {
  const MA_STORE_ID = useActiveStore();
  const {
    status: reportingStatus,
    phase1,
    dateFrom,
    dateTo,
    periodLabel,
  } = useLatestDataPeriod(MA_STORE_ID);
  // Source responses are not certified against the agreed financial definitions.
  // The period hook clears failed/partial responses; never replace them with samples.
  const sourceNumber = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toLocaleString("en-GB", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "Unavailable";
  const sourceStatus =
    reportingStatus === "loading"
      ? "Source figures loading"
      : reportingStatus === "error"
        ? "Source figures unavailable"
        : reportingStatus === "empty"
          ? "No source orders found in the reporting search"
          : reportingStatus === "stale"
            ? "Unverified source figures: historical period"
            : "Unverified source figures: latest completed period";

  // Fixed prototype inputs, independent of source responses and timeline selection.
  // These existing model assumptions are not a validated financial calculation.
  const SIM_REVENUE = 124_500;
  const CM_PCT = MONTHLY_CM_PCT;
  const CM_VALUE = 52_913;
  const CONTRIBUTION_PER_ORDER = 35;
  const sampleBridgeRows = BRIDGE_ROWS;

  // ── Simulator state ──────────────────────────────────────────────────────
  const [simMetaCac, setSimMetaCac] = useState(0);
  const [simShipping, setSimShipping] = useState(0);
  const [simDiscount, setSimDiscount] = useState(0);
  const [simReturns, setSimReturns] = useState(0);
  const [simPayment, setSimPayment] = useState(0);

  const simMetaContrib = Math.round(-simMetaCac * SIM_MULTIPLIERS.metaPerPct);
  const simShipContrib = Math.round(
    -simShipping * SIM_MULTIPLIERS.shippingPerPct,
  );
  const simDiscContrib = Math.round(
    -simDiscount * SIM_MULTIPLIERS.discountPerPp,
  );
  const simRetContrib = Math.round(-simReturns * SIM_MULTIPLIERS.returnsPerPp);
  const simPayContrib = Math.round(-simPayment * SIM_MULTIPLIERS.paymentPerPp);
  const simTotalContrib =
    simMetaContrib +
    simShipContrib +
    simDiscContrib +
    simRetContrib +
    simPayContrib;
  const simProjCP = CM_VALUE + simTotalContrib;
  const simProjCM = +((simProjCP / SIM_REVENUE) * 100).toFixed(1);
  const simProjCPO = +(simProjCP / SIM_ORDERS).toFixed(2);

  const getSimRiskLevel = (cm: number) => {
    if (cm >= 45)
      return {
        label: "Illustrative upper threshold reached",
        color: "emerald" as const,
      };
    if (cm >= 42)
      return {
        label: "Illustrative middle threshold",
        color: "amber" as const,
      };
    if (cm >= 40)
      return {
        label: "Illustrative lower threshold",
        color: "orange" as const,
      };
    return { label: "Below the illustrative threshold", color: "red" as const };
  };
  const simRisk = getSimRiskLevel(simProjCM);
  const isPro = canAccess("margin_simulator");

  // Dynamic simulator insight: label the largest positive contributor
  const simLargestContrib = [
    { value: simMetaContrib, label: "reducing Meta CAC" },
    { value: simShipContrib, label: "reducing shipping cost per order" },
    { value: simDiscContrib, label: "reducing discount depth" },
    { value: simRetContrib, label: "reducing returns" },
    { value: simPayContrib, label: "reducing payment processing fees" },
  ]
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)[0];

  const simInsight =
    simTotalContrib <= 0
      ? "Adjust the sliders to explore fixed sample assumptions; this is not a business forecast."
      : simLargestContrib
        ? `${simLargestContrib.label.charAt(0).toUpperCase() + simLargestContrib.label.slice(1)} produces the largest increase in this sample calculation; this is not a recommendation.`
        : "This is an illustrative scenario only.";

  return (
    <AppLayout showMonitoring={false}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Margin Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Actual margin reporting is unavailable. Explore a separate
            illustrative recovery model below.
          </p>
        </div>
        <TimelineSelector />
      </div>

      <section
        aria-label="Margin reporting status"
        className="rounded-2xl border border-border bg-card p-6 mb-6 space-y-3"
      >
        <h2 className="text-xl font-bold">
          Actual margin and recovery: unavailable
        </h2>
        <p className="text-sm text-muted-foreground">
          Validated sales and cost inputs are not connected to this page. No
          business-specific margin diagnosis, recovery estimate or recommended
          action is available.
        </p>
        <h3 className="font-semibold">Unverified source figures</h3>
        <p role="status" className="text-sm text-muted-foreground">
          {sourceStatus}
          {phase1 ? ` — ${periodLabel} (${dateFrom} to ${dateTo})` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          These source-reported revenue and AOV figures have not been validated
          against the agreed financial definitions. A successful response does
          not establish completeness or verified financial results. Source
          currency has not been verified.
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">
              Source-reported revenue
            </dt>
            <dd className="text-xl font-bold">
              {sourceNumber(phase1?.data.grossRevenue)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              Source-reported AOV
            </dt>
            <dd className="text-xl font-bold">
              {sourceNumber(phase1?.data.averageOrderValue)}
            </dd>
          </div>
        </dl>
      </section>
      <section
        aria-label="Sample margin model notice"
        className="rounded-2xl border border-primary/30 bg-primary/5 p-6 mb-6"
      >
        <h2 className="text-xl font-bold mb-2">
          Illustrative margin recovery model
        </h2>
        <p className="text-sm text-muted-foreground">
          Everything below uses fixed sample inputs, not results or
          recommendations for your business. Source figures and the selected
          reporting period do not change this model. Rankings, confidence
          labels, timing, thresholds and financial outputs are illustrative and
          have not been financially validated.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Sample simulator inputs: £124,500 revenue, £52,913 contribution and
          1,512 orders. The prototype bridge, trends and scenarios are separate
          examples and are not a reconciled financial report. The simulator’s
          30-day and annualised movement labels are illustrative extrapolations,
          not forecasts.
        </p>
      </section>

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">
          Sample Margin Levers
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Example levers and assumed impacts for exploring the prototype.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {RECOVERY_SCENARIOS.map((s) => (
          <div
            key={s.shortLabel}
            className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  {OPPORTUNITY_LEAK_TITLES[s.shortLabel]}
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {OPPORTUNITY_LEAK_TITLES[s.shortLabel]}
                </p>
              </div>
              {canAccess("opportunity_breakdown") ? (
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  £{s.cashImpact.toLocaleString()}
                </p>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <Lock className="w-3 h-3" /> PRO
                </span>
              )}
            </div>
            {canAccess("opportunity_breakdown") ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {OPPORTUNITY_LEAK_COPY[s.shortLabel]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {s.confidence === "high" ? "High" : "Medium"} sample
                    confidence
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {s.effort} effort
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {s.timeframe}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pro includes this sample lever’s assumed value.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">
          Sample Margin Recovery Plan
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Illustrative actions, with assumed impacts and timing; no
          business-specific plan has been assessed.
        </p>
      </div>
      {canAccess("opportunity_breakdown") ? (
        <div className="space-y-4 mb-8">
          {RECOVERY_SCENARIOS.map((s, i) => (
            <details
              key={s.shortLabel}
              open={i === 0}
              className={cn(
                "group rounded-2xl border bg-card shadow-sm overflow-hidden",
                i === 0
                  ? "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/10"
                  : "border-border/60",
              )}
            >
              <summary
                className={cn(
                  "list-none cursor-pointer px-6 py-5 transition-colors",
                  i === 0
                    ? "hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    : "hover:bg-secondary/20",
                )}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-start">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-bold",
                        i === 0
                          ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-foreground">
                          {i === 0
                            ? "Reduce Meta CAC / reallocate paid spend"
                            : i === 1
                              ? "Reduce shipping costs"
                              : "Lower discount depth"}
                        </p>
                        {i === 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 uppercase tracking-wider">
                            SAMPLE ORDER
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">
                        {s.detail}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[auto_auto_auto_auto] gap-2 lg:justify-end">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-700/40 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">
                        Sample impact
                      </p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        £{s.cashImpact.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                        Assumed confidence
                      </p>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {s.confidence}
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                        Effort
                      </p>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {s.effort}
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                        Timing
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {s.timeframe}
                      </p>
                    </div>
                  </div>
                </div>
              </summary>
              <div className="px-6 pb-5 -mt-1">
                <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 pl-11">
                  <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Example rationale
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {s.detail}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Illustrative steps
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {s.action}. Start with a controlled change, monitor
                      contribution per order, and widen the change only if
                      margin improves without unacceptable volume loss.
                    </p>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
              <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                Sample Margin Recovery Plan
              </p>
              <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                Pro includes the sample plan with illustrative values, timing
                and steps. Upgrading does not validate or connect actual margin
                reporting.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">
          Sample Margin Recovery Simulator
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Explore how fixed sample assumptions change the illustrative model.
        </p>
      </div>
      {isPro ? (
        <div className="rounded-2xl border border-primary/30 shadow-md mb-8 overflow-hidden bg-card">
          <div className="flex items-center gap-3 px-6 py-3 bg-primary/10 border-b border-primary/20">
            <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Sample Margin Recovery Simulator
            </span>
            <span className="ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
              Pro
            </span>
          </div>
          <div className="bg-primary/5 px-6 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mb-8">
              {[
                {
                  label: "Meta CAC change",
                  value: simMetaCac,
                  min: -25,
                  max: 25,
                  step: 1,
                  setter: setSimMetaCac,
                  suffix: "%",
                  low: "−25% (reduce)",
                  high: "+25% (increase)",
                },
                {
                  label: "Shipping cost change",
                  value: simShipping,
                  min: -20,
                  max: 20,
                  step: 1,
                  setter: setSimShipping,
                  suffix: "%",
                  low: "−20% (reduce)",
                  high: "+20% (increase)",
                },
                {
                  label: "Discount depth change",
                  value: simDiscount,
                  min: -5,
                  max: 5,
                  step: 0.5,
                  setter: setSimDiscount,
                  suffix: "pp",
                  low: "−5pp (tighter)",
                  high: "+5pp (deeper)",
                },
                {
                  label: "Returns rate change",
                  value: simReturns,
                  min: -5,
                  max: 5,
                  step: 0.5,
                  setter: setSimReturns,
                  suffix: "pp",
                  low: "−5pp (fewer)",
                  high: "+5pp (more)",
                },
              ].map((slider) => (
                <div key={slider.label}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">
                      {slider.label}
                    </p>
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        slider.value < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : slider.value > 0
                            ? "text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {slider.value > 0 ? "+" : ""}
                      {slider.value}
                      {slider.suffix}
                    </span>
                  </div>
                  <Slider
                    aria-label={slider.label}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={[slider.value]}
                    onValueChange={([v]) => slider.setter(v)}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>{slider.low}</span>
                    <span>{slider.high}</span>
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2 sm:max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">
                    Payment processing change
                  </p>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      simPayment < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : simPayment > 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {simPayment > 0 ? "+" : ""}
                    {simPayment.toFixed(1)}pp
                  </span>
                </div>
                <Slider
                  aria-label="Payment processing change"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={[simPayment]}
                  onValueChange={([v]) =>
                    setSimPayment(Math.round(v * 10) / 10)
                  }
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>−2pp (reduce)</span>
                  <span>+2pp (increase)</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Sample CM
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold font-display leading-none mb-1",
                    simProjCM >= 45
                      ? "text-emerald-600 dark:text-emerald-400"
                      : simProjCM >= 42
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-destructive",
                  )}
                >
                  {simProjCM}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Sample base: {CM_PCT}%
                </p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Sample contribution
                </p>
                <p className="text-2xl font-bold font-display text-foreground leading-none mb-1">
                  £{simProjCP.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sample base: £{CM_VALUE.toLocaleString()}
                </p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Sample movement
                </p>
                <PeriodImpact
                  value={simTotalContrib}
                  valueClassName="text-2xl font-display mb-1"
                />
              </div>
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Sample per order
                </p>
                <p className="text-2xl font-bold font-display text-foreground leading-none mb-1">
                  £{simProjCPO.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sample base: £{CONTRIBUTION_PER_ORDER.toFixed(2)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic mb-4 leading-relaxed">
              {simInsight}
            </p>
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
                simRisk.color === "emerald" &&
                  "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300",
                simRisk.color === "amber" &&
                  "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300",
                simRisk.color === "orange" &&
                  "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40 text-orange-800 dark:text-orange-300",
                simRisk.color === "red" &&
                  "bg-destructive/10 border-destructive/30 text-destructive",
              )}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span className="font-medium">
                <span className="font-bold">Sample threshold:</span>{" "}
                {simRisk.label}
              </span>
            </div>
            {(simMetaCac !== 0 ||
              simShipping !== 0 ||
              simDiscount !== 0 ||
              simReturns !== 0 ||
              simPayment !== 0) && (
              <button
                onClick={() => {
                  setSimMetaCac(0);
                  setSimShipping(0);
                  setSimDiscount(0);
                  setSimReturns(0);
                  setSimPayment(0);
                }}
                className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset sample scenario
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-primary/20 bg-card shadow-sm mb-8 overflow-hidden">
          <div className="px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-4">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground mb-2">
              Explore how fixed sample assumptions change the illustrative
              model.
            </p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
              Pro includes the illustrative simulator controls. Actual margin
              reporting remains unavailable.
            </p>
            <a
              href="/upgrade"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Unlock Simulator
            </a>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-6">
        Business-specific AI margin advice is unavailable while validated margin
        inputs are not connected.
      </p>

      <details className="group bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">
        <summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Supporting Sample Analysis
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Separate prototype examples: drivers, bridge, channels, trends
                and unit economics.
              </p>
            </div>
            <span className="text-xs font-semibold text-primary group-open:hidden">
              Expand
            </span>
            <span className="text-xs font-semibold text-primary hidden group-open:inline">
              Collapse
            </span>
          </div>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {canAccess("driver_breakdown") ? (
            <div className="space-y-8">
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  Sample Margin Drivers
                </h3>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="divide-y divide-border/40">
                    {[...CHANGE_DRIVERS]
                      .sort(
                        (a, b) =>
                          Math.abs(b.impactPerOrder) -
                          Math.abs(a.impactPerOrder),
                      )
                      .map((row) => (
                        <div
                          key={row.driver}
                          className="flex items-center justify-between px-4 py-3 gap-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {row.driver}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.change}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-destructive tabular-nums">
                            −£{Math.abs(row.impactPerOrder).toFixed(2)} / order
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  Sample Contribution Bridge
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Metric
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Total
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Per order
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleBridgeRows.map((row) => (
                        <tr
                          key={row.label}
                          className="border-b border-border/40"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {row.label}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {row.type === "revenue" ? "£" : "−£"}
                            {Math.abs(row.total).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {row.type === "revenue" ? "£" : "−£"}
                            {Math.abs(row.perOrder).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/5">
                        <td className="px-4 py-3 font-bold text-foreground">
                          Contribution Margin
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          £{CM_VALUE.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          £{CONTRIBUTION_PER_ORDER.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              {canAccess("channel_margin_analysis") && (
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">
                    Sample Margin by Channel
                  </h3>
                  <div className="space-y-3">
                    {[...CHANNELS]
                      .sort((a, b) => b.cm - a.cm)
                      .map((ch) => (
                        <div key={ch.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {ch.name}
                            </span>
                            <span className="text-sm font-bold tabular-nums">
                              {ch.cm}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${(ch.cm / 70) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">
                    Sample Margin Trend
                  </h3>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={TREND_DATA}
                        margin={{ top: 14, right: 14, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
                          dy={8}
                        />
                        <YAxis
                          domain={[38, 52]}
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          formatter={(v: number) => [
                            `${v}%`,
                            "Contribution Margin",
                          ]}
                        />
                        <ReferenceLine
                          y={CM_PCT}
                          stroke="hsl(var(--destructive))"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                        />
                        <Line
                          type="monotone"
                          dataKey="margin"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">
                    Sample Unit Economics
                  </h3>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={UNIT_ECON_HISTORY}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 10,
                          }}
                          dy={8}
                        />
                        <YAxis
                          domain={[0, 85]}
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
                          tickFormatter={(v) => `£${v}`}
                        />
                        <Tooltip
                          formatter={(v: number, name: string) => [
                            `£${v.toFixed(2)}`,
                            name === "revenue"
                              ? "Revenue per order"
                              : "Contribution per order",
                          ]}
                        />
                        <Bar
                          dataKey="revenue"
                          radius={[4, 4, 0, 0]}
                          fill="hsl(var(--primary))"
                          fillOpacity={0.25}
                        />
                        <Bar
                          dataKey="contribution"
                          radius={[4, 4, 0, 0]}
                          fill="hsl(var(--primary))"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 px-5 py-4">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                    Supporting sample analysis available on Pro
                  </p>
                  <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                    Pro includes illustrative drivers, bridge, channel
                    comparisons, trends and unit economics.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </details>

      <DataBenchmarkAssumptions
        benchmarkNote="Thresholds and confidence labels are illustrative assumptions, not verified benchmarks for your business."
        dataQualityNote="Actual margin reporting is unavailable. Source figures are unverified; every model, scenario and supporting analysis uses separate sample inputs."
        className="mb-2"
      />
    </AppLayout>
  );
}
