import { Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { ActionRecommendations } from "@/components/ActionRecommendations";
import type { Recommendation } from "@/components/ActionRecommendations";
import { cn } from "@/lib/utils";

// ─── Data constants ──────────────────────────────────────────────────────────

/** @dynamic Replace with live-computed growth quality score when data is connected */
const GQ_SCORE        = "B-";
const GQ_SCORE_PREV   = "B";
const GQ_SCORE_DIR    = "down" as const;

/** @dynamic */
const REPEAT_RATE       = 27.0;
const REPEAT_RATE_PREV  = 24.6;
const REPEAT_RATE_CHANGE = +(REPEAT_RATE - REPEAT_RATE_PREV).toFixed(1);

/** @dynamic */
const DISCOUNT_DEP       = 38.0;
const DISCOUNT_DEP_PREV  = 36.2;
const DISCOUNT_DEP_CHANGE = +(DISCOUNT_DEP - DISCOUNT_DEP_PREV).toFixed(1);

/** @dynamic */
const CAC_PAYBACK       = 1.4;
const CAC_PAYBACK_PREV  = 1.1;
const CAC_PAYBACK_CHANGE = +(CAC_PAYBACK - CAC_PAYBACK_PREV).toFixed(1);

/**
 * @ai-commentary Replace with AI-generated insight when ready.
 * cashLow / cashHigh:
 *   @dynamic Math.round(orderVolume * (ppLow / 100) * revenuePerOrder)
 */
const CFO_INSIGHT = {
  body: "Growth quality has weakened this month. Revenue remains positive, but more of that growth is being driven by discounting and higher-cost paid channels rather than repeat customer behaviour.",
  upside: {
    cashLow: 12_000,
    cashHigh: 28_000,
  },
  recommendations: [
    "Reduce blanket discounting",
    "Improve retention conversion",
    "Reallocate spend toward higher-margin channels",
  ],
} as const;

type ScoreStatus = "strong" | "watch" | "weak" | "mixed" | "declining";

/** @dynamic Score components computed from underlying metrics when live */
const SCORE_COMPONENTS: {
  label: string;
  status: ScoreStatus;
  grade: string;
  explanation: string;
  score: number;
}[] = [
  {
    label: "Retention quality",
    status: "strong",
    grade: "B+",
    explanation: "Repeat purchase rate improved 2.4pp — more customers returning without paid re-acquisition.",
    score: 82,
  },
  {
    label: "Discount reliance",
    status: "weak",
    grade: "D+",
    explanation: "38% of orders include a discount code — well above the healthy benchmark of <25%.",
    score: 32,
  },
  {
    label: "CAC efficiency",
    status: "watch",
    grade: "C+",
    explanation: "CAC payback rose to 1.4 orders. Meta CPM increases are reducing paid channel efficiency.",
    score: 55,
  },
  {
    label: "Contribution quality",
    status: "declining",
    grade: "C+",
    explanation: "Contribution margin at 42.3% is below the 45–55% target range and declining month-on-month.",
    score: 52,
  },
  {
    label: "Channel mix quality",
    status: "mixed",
    grade: "C",
    explanation: "Paid mix is increasing while organic and email proportions decline — raising blended CAC.",
    score: 48,
  },
];

/**
 * @dynamic Letter grade → numeric score for trend line.
 * Replace score values with live computed quality index when data is connected.
 */
const TREND_DATA = [
  { month: "Apr",  score: 87, grade: "B+"  },
  { month: "May",  score: 83, grade: "B"   },
  { month: "Jun",  score: 83, grade: "B"   },
  { month: "Jul",  score: 80, grade: "B-"  },
  { month: "Aug",  score: 80, grade: "B-"  },
  { month: "Sep",  score: 83, grade: "B"   },
  { month: "Oct",  score: 87, grade: "B+"  },
  { month: "Nov",  score: 83, grade: "B"   },
  { month: "Dec",  score: 80, grade: "B-"  },
  { month: "Jan",  score: 76, grade: "C+"  },
  { month: "Feb",  score: 79, grade: "B-"  },
  { month: "Mar",  score: 76, grade: "B-"  },
];

/** @ai-commentary Replace with dynamically generated driver list when ready */
const KEY_DRIVERS: { text: string; dir: "positive" | "negative" | "neutral" }[] = [
  { text: "Repeat purchase rate improved +2.4pp month-on-month", dir: "positive" },
  { text: "Discount depth increased 1.8pp vs prior month", dir: "negative" },
  { text: "Meta CAC increased 14% — paid channel efficiency declining", dir: "negative" },
  { text: "Organic and email mix declined as a proportion of total revenue", dir: "negative" },
  { text: "Email-driven orders maintained the highest contribution margin", dir: "positive" },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "gq1",
    text: "Reduce discount usage on returning customers to lower dependency below 30%.",
    impact: "high",
  },
  {
    id: "gq2",
    text: "Shift budget away from lowest-margin paid channels toward SEO and email.",
    impact: "high",
  },
  {
    id: "gq3",
    text: "Strengthen post-purchase email flows to lift the repeat purchase rate above 30%.",
    impact: "medium",
  },
  {
    id: "gq4",
    text: "Focus acquisition campaigns on products with the highest contribution margin.",
    impact: "medium",
  },
  {
    id: "gq5",
    text: "Set up discount effectiveness tracking to identify low-ROI promotional codes.",
    impact: "quick-win",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ScoreStatus, { label: string; bar: string; badge: string; text: string }> = {
  strong:   { label: "Strong",   bar: "bg-emerald-500",  badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", text: "text-emerald-700 dark:text-emerald-300" },
  watch:    { label: "Watch",    bar: "bg-amber-400",    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",        text: "text-amber-700 dark:text-amber-300"    },
  weak:     { label: "Weak",     bar: "bg-destructive",  badge: "bg-destructive/10 text-destructive",                                          text: "text-destructive"                      },
  mixed:    { label: "Mixed",    bar: "bg-slate-400",    badge: "bg-secondary text-muted-foreground",                                          text: "text-muted-foreground"                 },
  declining:{ label: "Declining",bar: "bg-amber-500",    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",        text: "text-amber-700 dark:text-amber-300"    },
};

function gradeColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GrowthQuality() {
  return (
    <AppLayout>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Growth Quality Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Understand whether growth is being driven by retention, healthy channel mix, and profitable customer acquisition.
          </p>
        </div>
        <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg">
          March 2026
        </span>
      </div>

      {/* ── CFO Insight ── */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm mb-8 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            CFO Insight
          </span>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {CFO_INSIGHT.body}
          </p>

          {/* Upside callout */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/25 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0 mt-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">
                If discount dependency and CAC efficiency return to prior levels, growth quality could
                improve materially next month, with an estimated contribution uplift of{" "}
                <span className="font-bold text-emerald-700 dark:text-emerald-300 text-base">
                  £{CFO_INSIGHT.upside.cashLow.toLocaleString()}–£{CFO_INSIGHT.upside.cashHigh.toLocaleString()}
                </span>{" "}
                at current sales volume.
              </p>
            </div>
          </div>

          {/* Recommended focus */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recommended focus:
            </p>
            <ul className="space-y-1.5">
              {CFO_INSIGHT.recommendations.map((rec) => (
                <li key={rec} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-[5px]" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Summary tag */}
          <div className="flex flex-wrap gap-3 pt-1 border-t border-primary/15">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-800 dark:text-emerald-300">
                Potential upside next month:{" "}
                <span className="font-bold">
                  £{(CFO_INSIGHT.upside.cashLow / 1000).toFixed(0)}k–£{(CFO_INSIGHT.upside.cashHigh / 1000).toFixed(0)}k
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Growth Quality Score */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Growth Quality Score</p>
          <p className="text-4xl font-display font-bold text-foreground">{GQ_SCORE}</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowDownRight className="w-3 h-3" />
              Down from {GQ_SCORE_PREV}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Composite score across retention, discount reliance, and channel efficiency
          </p>
        </div>

        {/* Repeat Purchase Rate */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Repeat Purchase Rate</p>
          <p className="text-4xl font-display font-bold text-foreground">{REPEAT_RATE}%</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              +{REPEAT_RATE_CHANGE}pp vs last month
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Share of orders from returning customers
          </p>
        </div>

        {/* Discount Dependency */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Discount Dependency</p>
          <p className="text-4xl font-display font-bold text-foreground">{DISCOUNT_DEP}%</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              Up {DISCOUNT_DEP_CHANGE}pp vs last month
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Orders using a discount code — target below 25%
          </p>
        </div>

        {/* CAC Payback */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">CAC Payback Period</p>
          <p className="text-4xl font-display font-bold text-foreground">
            {CAC_PAYBACK}{" "}
            <span className="text-lg font-medium text-muted-foreground">orders</span>
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              from {CAC_PAYBACK_PREV} last month
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Orders needed to recover the cost of acquiring each new customer
          </p>
        </div>
      </div>

      {/* ── Score Breakdown ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">What is driving the score?</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Five components weighted to produce the overall growth quality grade.
          </p>
        </div>
        <div className="space-y-5">
          {SCORE_COMPONENTS.map((c) => {
            const cfg = STATUS_CONFIG[c.status];
            return (
              <div key={c.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{c.label}</span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                        cfg.badge
                      )}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <span className={cn("text-sm font-bold", cfg.text)}>{c.grade}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-secondary rounded-full mb-1.5">
                  <div
                    className={cn("h-1.5 rounded-full transition-all", cfg.bar)}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{c.explanation}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Growth Quality Trend ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Growth Quality Trend</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            12-month composite growth quality score — higher is healthier.
          </p>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={TREND_DATA}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                dy={8}
              />
              <YAxis
                domain={[60, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(v: number) => {
                  if (v >= 87) return "B+";
                  if (v >= 83) return "B";
                  if (v >= 79) return "B-";
                  if (v >= 75) return "C+";
                  if (v >= 70) return "C";
                  return "C-";
                }}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgb(0 0 0 / .1)" }}
                formatter={(_: number, __: string, props: { payload?: { grade?: string } }) =>
                  [props?.payload?.grade ?? "", "Grade"]
                }
              />
              {/* Healthy threshold */}
              <ReferenceLine y={83} stroke="hsl(var(--success))" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Healthy", position: "insideTopRight", fontSize: 11, fill: "hsl(var(--success))" }} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={(props: { cx: number; cy: number; payload: { score: number } }) => (
                  <circle
                    key={`dot-${props.cx}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={gradeColor(props.payload.score)}
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-snug">
          Score peaked at B+ in October before declining through Q1 2026. The current B- reflects
          increasing discount dependency and rising paid acquisition costs offsetting improved retention.
        </p>
      </div>

      {/* ── Key Growth Drivers ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <h3 className="font-semibold text-lg text-foreground mb-1">Key Growth Drivers This Month</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Factors with the greatest influence on growth quality in March 2026.
        </p>
        <ul className="space-y-3">
          {KEY_DRIVERS.map((d) => (
            <li key={d.text} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
              <span
                className={cn(
                  "mt-0.5 flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                  d.dir === "positive"
                    ? "bg-emerald-100 dark:bg-emerald-900/40"
                    : d.dir === "negative"
                    ? "bg-destructive/10"
                    : "bg-secondary"
                )}
              >
                {d.dir === "positive" && <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                {d.dir === "negative" && <TrendingDown className="w-3 h-3 text-destructive" />}
                {d.dir === "neutral" && <Minus className="w-3 h-3 text-muted-foreground" />}
              </span>
              <span className="text-sm text-foreground leading-snug">{d.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Recommended Actions ── */}
      <ActionRecommendations
        recommendations={RECOMMENDATIONS}
        title="What to do next"
        subtitle="Practical actions to improve growth quality and profitable acquisition"
        defaultExpanded
      />
    </AppLayout>
  );
}
