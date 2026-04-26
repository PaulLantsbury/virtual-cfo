import {
  ArrowUpRight, ArrowDownRight, Minus,
  Download, Sparkles, TrendingUp,
  ArrowRight, ChevronRight, Lock, Lightbulb,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDashboardKpis } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TopDrivers, type Driver } from "@/components/TopDrivers";
import { ActionRecommendations, type Recommendation } from "@/components/ActionRecommendations";
import { canAccess } from "@/lib/plan";

// ─── Data constants ───────────────────────────────────────────────────────────

/**
 * @ai-commentary Replace with AI-generated insight when ready.
 * upside cashLow/cashHigh:
 *   @dynamic Math.round(orderVolume * (ppLow / 100) * revenuePerOrder)
 */
const CFO_INSIGHT = {
  body: "Contribution margin is declining despite revenue growth, driven primarily by higher shipping costs, rising Meta CAC, and increased discount usage.",
  upside: {
    cashLow:  18_000,
    cashHigh: 42_000,
  },
} as const;


/** @dynamic Replace with live-computed driver list when data is connected */
const TOP_DRIVERS: Driver[] = [
  {
    id: "1",
    text: "Margin down due to increased shipping and fulfilment costs",
    proDetail: "Fulfilment cost rose 12% per order. Estimated contribution impact: –£3.2k vs prior period.",
    trend: "worsening",
    href: "/margin-analysis",
  },
  {
    id: "2",
    text: "Repeat purchase rate improving month-on-month",
    trend: "improving",
    href: "/growth-quality",
  },
  {
    id: "3",
    text: "Ad spend efficiency declining — higher CAC with lower ROAS",
    proDetail: "Meta CAC up 14% MoM — now £28 per customer vs £24. ROAS fell from 3.1x to 2.7x.",
    trend: "worsening",
    href: "/marketing-efficiency",
  },
  {
    id: "4",
    text: "Discount usage rising faster than revenue growth",
    proDetail: "Discount-attached orders grew 8%; total revenue grew 5.2%. Estimated margin drag: –£4.2k per month.",
    trend: "worsening",
    href: "/margin-analysis",
  },
  {
    id: "5",
    text: "Average order value holding steady",
    trend: "neutral",
  },
];

/** @ai-commentary Replace with AI-ranked action list when ready */
const RECOMMENDATIONS: Recommendation[] = [
  { id: "1", text: "Review fulfilment partner pricing to improve contribution margin",           impact: "high"      },
  { id: "2", text: "Reduce discount usage on returning customers",                              impact: "high"      },
  { id: "3", text: "Reallocate ad spend from Meta to Google Shopping",                          impact: "medium"    },
  { id: "4", text: "Investigate rising customer acquisition costs",                             impact: "medium"    },
  { id: "5", text: "Set up a post-purchase email sequence to lift repeat purchase rate",        impact: "quick-win" },
];

const HEALTH_MODULES = [
  {
    id:       "profit",
    title:    "Profit Quality",
    subtitle: "Where your contribution margin is being made — and where it's being eroded.",
    cta:      "Analyse margin",
    href:     "/margin-analysis",
  },
  {
    id:       "growth",
    title:    "Growth Quality",
    subtitle: "Whether growth is healthy and self-sustaining — or dependent on discounting and paid spend.",
    cta:      "Analyse growth",
    href:     "/growth-quality",
  },
  {
    id:       "acquisition",
    title:    "Acquisition Efficiency",
    subtitle: "Whether paid channels are generating profitable customers — or just revenue.",
    cta:      "Diagnose acquisition",
    href:     "/marketing-efficiency",
  },
  {
    id:       "opportunities",
    title:    "Opportunities",
    subtitle: "Your highest-impact improvement actions, ranked and quantified.",
    cta:      "See all opportunities",
    href:     "/opportunities",
  },
  {
    id:       "cash",
    title:    "Cash Efficiency",
    subtitle: "Working capital efficiency and cash recovery analysis.",
    cta:      "",
    href:     "#",
    badge:    "Coming soon",
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Impact badge used in both free and pro action plan rows */
function ImpactBadge({ impact }: { impact: Recommendation["impact"] }) {
  const cfg = {
    high:      "bg-destructive/10 text-destructive",
    medium:    "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    "quick-win": "bg-success/10 text-success",
  } as const;
  const label = {
    high: "High impact",
    medium: "Medium impact",
    "quick-win": "Quick win",
  } as const;
  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0",
      cfg[impact],
    )}>
      {label[impact]}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();

  const isPro           = canAccess("dashboard_recovery_upside");
  const hasActionPlan   = canAccess("dashboard_full_action_plan");
  const hasOpportunities = canAccess("dashboard_opportunities_module");
  const hasDriverDetail = canAccess("dashboard_driver_detail");

  return (
    <AppLayout>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Health Overview</h1>
          <p className="text-muted-foreground mt-1">What changed this month, where performance is at risk, and what to act on.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── CFO Insight ── */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">CFO Insight</span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {CFO_INSIGHT.body}
          </p>
        </div>
      </div>

      {/* ── Recoverable contribution strip ── */}
      {isPro ? (
        /* Pro: quantified £ value */
        <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-6 py-4 mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/60 dark:text-emerald-500/60 mb-0.5">
                Recoverable Contribution Opportunity
              </p>
              <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-snug">
                Potential upside next month:{" "}
                <span className="font-bold text-emerald-700 dark:text-emerald-300 text-base">
                  £{(CFO_INSIGHT.upside.cashLow  / 1_000).toFixed(0)}k–£{(CFO_INSIGHT.upside.cashHigh / 1_000).toFixed(0)}k
                </span>
                {" "}if the issues above are addressed
              </p>
            </div>
          </div>
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
          >
            View opportunities <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        /* Free: direction only + upgrade CTA */
        <div className="rounded-2xl border border-border/60 bg-secondary/30 px-6 py-4 mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary shrink-0">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                Recoverable Contribution Opportunity
              </p>
              <p className="text-sm text-foreground leading-snug">
                Recovery opportunity identified from the issues above
              </p>
            </div>
          </div>
          <a
            href="/upgrade"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap shrink-0"
          >
            Unlock quantified contribution recovery <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* ── KPI Grid (from API) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpisLoading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-32 bg-secondary rounded-2xl animate-pulse" />
            ))
          : kpis?.cards.map((kpi) => (
              <div
                key={kpi.id}
                className="bg-card rounded-2xl p-5 shadow-sm border border-border/50"
              >
                <p className="text-sm font-medium text-muted-foreground mb-1">{kpi.title}</p>
                <p className="text-3xl font-display font-bold text-foreground mb-3">{kpi.value}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold",
                    kpi.trend === "up"      ? "bg-success/10 text-success" :
                    kpi.trend === "down"    ? "bg-destructive/10 text-destructive" :
                                              "bg-secondary text-muted-foreground",
                  )}>
                    {kpi.trend === "up"      && <ArrowUpRight   className="w-3 h-3" />}
                    {kpi.trend === "down"    && <ArrowDownRight  className="w-3 h-3" />}
                    {kpi.trend === "neutral" && <Minus           className="w-3 h-3" />}
                    {!kpi.changeText && `${kpi.change}%`}
                  </span>
                  <span className="text-muted-foreground leading-snug">
                    {kpi.changeText ?? kpi.changeLabel}
                  </span>
                </div>
                {kpi.explanation && (
                  <p className="mt-2.5 text-xs text-muted-foreground/80 leading-snug border-t border-border/50 pt-2.5">
                    {kpi.explanation}
                  </p>
                )}
              </div>
            ))}
      </div>

      {/* ── Top Drivers ── */}
      <TopDrivers drivers={TOP_DRIVERS} isPro={hasDriverDetail} />

      {/* ── What to do next ── */}
      {hasActionPlan ? (
        /* Pro: full 3-action list */
        <ActionRecommendations
          recommendations={RECOMMENDATIONS.slice(0, 3)}
          subtitle="Three actions ranked by commercial impact"
          viewAllHref="/opportunities"
          defaultExpanded
        />
      ) : (
        /* Free: first action visible, remaining two blurred, upgrade CTA */
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">

          {/* Header — matches ActionRecommendations shell */}
          <div className="flex items-center justify-between gap-4 p-6 pb-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
                <Lightbulb className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground leading-none mb-1">What to do next</h3>
                <p className="text-sm text-muted-foreground">Three actions ranked by commercial impact</p>
              </div>
            </div>
          </div>

          <div className="px-6 pt-5 pb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Recommended actions
            </p>

            <ul className="space-y-0">
              {/* First action — fully visible */}
              <li className="flex items-center gap-3 py-2.5 border-b border-border/40">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                <span className="flex-1 text-sm text-foreground">{RECOMMENDATIONS[0].text}</span>
                <ImpactBadge impact={RECOMMENDATIONS[0].impact} />
              </li>

              {/* Second and third actions — blurred ghost rows */}
              {RECOMMENDATIONS.slice(1, 3).map((rec) => (
                <li
                  key={rec.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0 select-none pointer-events-none"
                  aria-hidden="true"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20 shrink-0" />
                  <span className="flex-1 text-sm text-foreground blur-[5px] opacity-40">
                    {rec.text}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-muted-foreground/30 blur-[4px] opacity-40 whitespace-nowrap">
                    High impact
                  </span>
                </li>
              ))}
            </ul>

            {/* Upgrade CTA */}
            <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                2 more priority actions available on Pro
              </p>
              <a
                href="/upgrade"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5" />
                Unlock full prioritised action plan
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Business Health Modules ── */}
      <div className="mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Business Health Modules</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Go deeper on any area to understand what's driving it and what to do about it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HEALTH_MODULES.map((mod) => {

            /* Coming soon card */
            if (mod.badge) {
              return (
                <div
                  key={mod.id}
                  className="bg-card rounded-2xl p-5 border border-border/50 opacity-55"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm text-foreground">{mod.title}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-muted-foreground shrink-0 whitespace-nowrap">
                      {mod.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{mod.subtitle}</p>
                </div>
              );
            }

            /* Opportunities card — Pro-gated */
            if (mod.id === "opportunities" && !hasOpportunities) {
              return (
                <div
                  key={mod.id}
                  className="bg-card rounded-2xl p-5 border border-border/50 relative overflow-hidden"
                >
                  {/* Blurred ghost content */}
                  <div className="blur-sm opacity-40 select-none pointer-events-none" aria-hidden="true">
                    <p className="font-semibold text-sm text-foreground mb-1.5">{mod.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug mb-4">{mod.subtitle}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      {mod.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {/* Upgrade overlay */}
                  <div className="absolute inset-0 bg-card/75 rounded-2xl flex flex-col items-center justify-center text-center p-5 gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                      <Lock className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      Highest-value improvement opportunities identified
                    </p>
                    <a
                      href="/upgrade"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Unlock opportunities <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            }

            /* Normal active card */
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className="bg-card rounded-2xl p-5 border border-border/50 hover:border-primary/30 hover:shadow-md transition-all group block"
              >
                <p className="font-semibold text-sm text-foreground mb-1.5">{mod.title}</p>
                <p className="text-xs text-muted-foreground leading-snug mb-4">{mod.subtitle}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                  {mod.cta} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

    </AppLayout>
  );
}
