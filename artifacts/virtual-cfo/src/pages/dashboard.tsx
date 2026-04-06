import {
  ArrowUpRight, ArrowDownRight, Minus,
  Download, Sparkles, TrendingUp,
  ArrowRight, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDashboardKpis } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TopDrivers, type Driver } from "@/components/TopDrivers";
import { ActionRecommendations, type Recommendation } from "@/components/ActionRecommendations";

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
  { id: "1", text: "Margin down due to increased shipping and fulfilment costs",       trend: "worsening", href: "/margin-analysis"       },
  { id: "2", text: "Repeat purchase rate improving month-on-month",                    trend: "improving", href: "/growth-quality"         },
  { id: "3", text: "Ad spend efficiency declining — higher CAC with lower ROAS",       trend: "worsening", href: "/marketing-efficiency"   },
  { id: "4", text: "Discount usage rising faster than revenue growth",                  trend: "worsening", href: "/margin-analysis"       },
  { id: "5", text: "Average order value holding steady",                                trend: "neutral"                                   },
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();

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
          <Button>Create Report</Button>
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
      <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-6 py-4 mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/60 dark:text-emerald-500/60 mb-0.5">
              Recoverable contribution opportunity
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
      <TopDrivers drivers={TOP_DRIVERS} />

      {/* ── What to do next (top 3 only) ── */}
      <ActionRecommendations
        recommendations={RECOMMENDATIONS.slice(0, 3)}
        subtitle="Three actions ranked by commercial impact"
        viewAllHref="/opportunities"
        defaultExpanded
      />

      {/* ── Business Health Modules ── */}
      <div className="mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Business Health Modules</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Go deeper on any area to understand what's driving it and what to do about it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HEALTH_MODULES.map((mod) =>
            mod.badge ? (
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
            ) : (
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
            )
          )}
        </div>
      </div>

    </AppLayout>
  );
}
