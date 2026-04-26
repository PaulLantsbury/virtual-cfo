import {
  ArrowUpRight, ArrowDownRight, Minus, Download,
  Sparkles, TrendingUp, AlertTriangle, ArrowRight,
  ChevronRight, Lock,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TopDrivers, type Driver } from "@/components/TopDrivers";
import { canAccess } from "@/lib/plan";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { TimingBadge } from "@/components/TimingBadge";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";

// ─── Data constants ───────────────────────────────────────────────────────────

const CFO_INSIGHT = {
  body: "The fastest route to improvement is reducing fulfilment costs, tightening discount exposure on returning customers and reallocating inefficient Meta spend toward higher-contribution channels.",
  upside: { cashLow: 18_000, cashHigh: 42_000 },
} as const;

const KPI_CARDS = [
  {
    id: "cm",   title: "Contribution Margin",      value: "42.3%",         change: "↓ 2.8% vs last month",   status: "warning",
    text: "Margin is below target and weakening.",
  },
  {
    id: "rc",   title: "Recoverable Contribution", value: "£18k–£42k",     change: "Immediate margin recovery available",  status: "positive",
    text: "Immediate margin recovery available from pricing, marketing and fulfilment improvements.",
  },
  {
    id: "cr",   title: "Cash Runway",              value: "3.4 months",    change: "Moderate",                status: "warning",
    text: "Cash remains positive, but runway is tightening.",
  },
  {
    id: "dd",   title: "Discount Dependency",      value: "38%",           change: "↑ 11% vs last month",    status: "danger",
    text: "High reliance on promotions to sustain growth.",
  },
  {
    id: "ae",   title: "Acquisition Efficiency",   value: "Meta CAC +14%", change: "↓ efficiency",           status: "danger",
    text: "Meta CAC is rising faster than contribution per order.",
  },
  {
    id: "rpr",  title: "Repeat Purchase Rate",     value: "28%",           change: "↑ 4.2% vs last month",   status: "positive",
    text: "Retention is strengthening as more customers place second orders.",
  },
  {
    id: "mr",   title: "Monthly Revenue",          value: "£124,500",      change: "↑ 12.4% vs last month",  status: "positive",
    text: "Revenue is growing, but margin quality is weakening.",
  },
  {
    id: "np",   title: "Net Profit",               value: "£56,300",       change: "↑ 18.7% vs last month",  status: "positive",
    text: "Profit remains positive, but quality of growth needs attention.",
  },
] as const;

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

const PRIORITY_ACTIONS = [
  {
    title:  "Reduce fulfilment cost leakage",
    impact: "+£6.8k contribution",
    reason: "Fulfilment and shipping costs are the largest margin drag this month.",
    badge:  "High impact",
    color:  "red",
    timing: "2–4 weeks" as const,
  },
  {
    title:  "Tighten discount exposure",
    impact: "+£4.2k contribution",
    reason: "Discount usage is rising faster than revenue growth.",
    badge:  "High impact",
    color:  "red",
    timing: "Immediate" as const,
  },
  {
    title:  "Reallocate inefficient Meta spend",
    impact: "+£3.1k contribution",
    reason: "Meta CAC has increased while ROAS has weakened.",
    badge:  "Medium impact",
    color:  "orange",
    timing: "1–2 weeks" as const,
  },
] as const;

// Engine cards — ordered per spec
const HEALTH_MODULES = [
  {
    id:       "profit",
    title:    "Profit Quality / Margin Analysis",
    headline: "£20.4k margin recovery identified",
    subtitle: "See where contribution margin is being eroded and how to recover it.",
    cta:      "Analyse margin",
    href:     "/margin-analysis",
  },
  {
    id:       "pricing",
    title:    "Pricing Optimisation",
    headline: "£52k recoverable contribution",
    subtitle: "Identify discount leakage and pricing opportunities.",
    cta:      "Improve pricing",
    href:     "/pricing-optimisation",
  },
  {
    id:       "growth",
    title:    "Growth Quality",
    headline: "38% discount dependency",
    subtitle: "Understand whether growth is healthy or reliant on promotions and paid spend.",
    cta:      "Analyse growth",
    href:     "/growth-quality",
  },
  {
    id:       "acquisition",
    title:    "Marketing / Acquisition Efficiency",
    headline: "Meta CAC +14%",
    subtitle: "Diagnose which channels are creating profitable customers.",
    cta:      "Diagnose acquisition",
    href:     "/marketing-efficiency",
  },
  {
    id:       "cash",
    title:    "Cash Control",
    headline: "£64k cash headroom opportunity",
    subtitle: "See where cash is trapped, how much runway you have, and what actions protect liquidity.",
    cta:      "Review cash position",
    href:     "/cash-control",
  },
  {
    id:       "scenario",
    title:    "Scenario Lab / Opportunities",
    headline: "£18k–£42k contribution upside",
    subtitle: "See the highest-impact improvement actions and model the combined impact.",
    cta:      "Model opportunity",
    href:     "/scenario-lab",
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const isPro           = canAccess("dashboard_recovery_upside");
  const hasDriverDetail = canAccess("dashboard_driver_detail");

  return (
    <AppLayout>

      {/* ══ PAGE HEADER ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Control Centre</h1>
          <p className="text-muted-foreground mt-1 text-sm">See what is happening, how much profit and cash is at risk, and where to act first.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button variant="outline" className="bg-white dark:bg-transparent">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ══ BUSINESS HEALTH VERDICT HERO ════════════════════════════════════ */}
      <div className="bg-card rounded-2xl shadow-sm border border-amber-200/70 dark:border-amber-800/30 mb-5 overflow-hidden">
        {/* Overall verdict row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 pt-5 pb-4 border-b border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-amber-400 dark:bg-amber-500 shadow-md shadow-amber-400/30 shrink-0">
              <span className="text-white font-black text-sm">!</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Overall Business Health</p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-400 tracking-tight">AMBER — Moderate Risk</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed sm:max-w-sm">
            The business is profitable, but margin quality, acquisition efficiency and cash runway are weakening.
          </p>
        </div>

        {/* Inline £9.4k context strip */}
        <div className="flex items-start gap-2.5 px-6 py-3 bg-amber-50/70 dark:bg-amber-950/15 border-b border-amber-100 dark:border-amber-900/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
            This month's performance reduced contribution by approximately £9.4k vs last month, driven by fulfilment cost inflation, Meta CAC deterioration and increased discounting.
          </p>
        </div>

        {/* Free-only upgrade hint */}
        {!isPro && (
          <div className="px-6 py-2.5 bg-amber-50/40 dark:bg-amber-950/10 border-b border-amber-100/60 dark:border-amber-900/15">
            <p className="text-xs text-amber-700/70 dark:text-amber-400/60 leading-relaxed">
              We've identified £18k–£42k monthly improvement potential. Unlock the full recovery roadmap below.
            </p>
          </div>
        )}

        {/* Traffic-light scorecard */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
            {[
              { area: "Profitability",          label: "Healthy",               text: "Profit remains positive.",                         style: "green" },
              { area: "Margin Quality",          label: "Weakening",             text: "Contribution margin is below target and falling.",  style: "amber" },
              { area: "Cash Runway",             label: "Runway tightening",     text: "Cash remains positive, but runway is tightening.",  style: "amber" },
              { area: "Acquisition Efficiency",  label: "At risk",               text: "Meta CAC is rising and ROAS is weakening.",         style: "red"   },
              { area: "Retention",               label: "Retention strengthening", text: "Repeat purchase rate is improving.",              style: "green" },
            ].map(({ area, label, text, style }) => (
              <div key={area} className={cn(
                "rounded-xl p-3 border flex flex-col gap-1.5",
                style === "green" ? "bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200/60 dark:border-emerald-800/30"
                : style === "amber" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-700/30"
                : "bg-rose-50 dark:bg-rose-950/15 border-rose-200/60 dark:border-rose-700/30"
              )}>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    style === "green" ? "bg-emerald-500"
                    : style === "amber" ? "bg-amber-400"
                    : "bg-rose-500"
                  )} />
                  <span className={cn(
                    "text-[11px] font-bold",
                    style === "green" ? "text-emerald-700 dark:text-emerald-400"
                    : style === "amber" ? "text-amber-700 dark:text-amber-400"
                    : "text-rose-700 dark:text-rose-400"
                  )}>{label}</span>
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground">{area}</p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight">{text}</p>
              </div>
            ))}
          </div>

          {/* Health position bar */}
          <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-border/40">
            {[
              { pos: "Strong",        active: false, done: true  },
              { pos: "Stable",        active: false, done: true  },
              { pos: "Moderate Risk", active: true,  done: false },
              { pos: "High Risk",     active: false, done: false },
              { pos: "Critical",      active: false, done: false },
            ].map(({ pos, active, done }) => (
              <div key={pos} className={cn(
                "flex-1 text-center py-2 text-[10px] font-bold border-r border-border/30 last:border-0 transition-colors",
                active  ? "bg-amber-400 dark:bg-amber-500 text-white"
                : done  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-500"
                : "bg-secondary/40 text-muted-foreground/50"
              )}>
                {pos}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AiCfoAskCard pageId="dashboard" />

      {/* ══ RECOVERABLE CONTRIBUTION OPPORTUNITY ════════════════════════════ */}
      <div className="bg-card rounded-2xl shadow-sm border border-emerald-200/70 dark:border-emerald-800/40 mb-5 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200/60 dark:border-emerald-800/30">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {isPro ? "Recoverable contribution available immediately" : "Recoverable contribution identified"}
          </span>
        </div>
        <div className="px-6 py-5">
          {isPro ? (
            /* ── Pro layout ─────────────────────────────────────────────────── */
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1">
                <p className="text-4xl font-display font-black text-emerald-700 dark:text-emerald-400 mb-1">
                  £18k–£42k
                  <span className="text-lg font-bold text-emerald-600/70 dark:text-emerald-500/70 ml-1">/ month</span>
                </p>
                <p className="text-sm text-foreground font-medium mb-1">
                  Estimated monthly contribution upside if the issues above are addressed.
                </p>
                <p className="text-xs text-muted-foreground mb-3 leading-snug">Most recoverable within 30–60 days.</p>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-700/30">
                    £12k within 30 days
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-500 border border-emerald-200/40 dark:border-emerald-800/30">
                    £30k within 90 days
                  </span>
                </div>
                <ConfidenceBadge
                  level="Medium-High"
                  helper="Based on 90-day trading data, discount history and channel performance trends."
                />
              </div>
              <div className="shrink-0 sm:pt-2">
                <Link href="/profit-opportunities" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors">
                  See action plan <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            /* ── Free layout: show headline value, gate the detail ─────────── */
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1">
                <p className="text-4xl font-display font-black text-emerald-700 dark:text-emerald-400 mb-1">
                  £18k–£42k
                  <span className="text-lg font-bold text-emerald-600/70 dark:text-emerald-500/70 ml-1">/ month</span>
                </p>
                <p className="text-sm text-foreground font-medium mb-1">
                  Estimated monthly contribution upside if the issues above are addressed.
                </p>
                <p className="text-xs text-muted-foreground mb-3 leading-snug">Most recoverable within 30–60 days.</p>
                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary text-muted-foreground/40 border border-border/40 blur-[2px] select-none pointer-events-none">
                    <Lock className="w-3 h-3" /> £12k within 30 days
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary text-muted-foreground/40 border border-border/40 blur-[2px] select-none pointer-events-none">
                    <Lock className="w-3 h-3" /> £30k within 90 days
                  </span>
                </div>
                <div className="mb-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Opportunity sources identified</p>
                  <ul className="space-y-1.5">
                    {[
                      "Fulfilment cost optimisation",
                      "Discount discipline improvements",
                      "Channel reallocation potential",
                      "Pricing leakage recovery",
                    ].map(src => (
                      <li key={src} className="flex items-center gap-2 text-xs text-muted-foreground/50 select-none">
                        <Lock className="w-3 h-3 shrink-0 text-muted-foreground/30" />
                        <span className="blur-[2px]">{src}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="shrink-0 sm:pt-2">
                <a href="/upgrade" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                  <Lock className="w-3.5 h-3.5" /> Unlock the full opportunity breakdown
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ FASTEST ROUTE TO PROFIT IMPROVEMENT ════════════════════════════ */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm mb-5 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Fastest Route to Profit Improvement</span>
        </div>
        <div className="px-6 py-5">
          {isPro ? (
            <p className="text-sm font-medium text-foreground leading-relaxed">{CFO_INSIGHT.body}</p>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground leading-relaxed mb-3">
                We've identified three priority actions with the highest contribution impact.
              </p>
              <a href="/upgrade" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                <Lock className="w-3.5 h-3.5" /> Unlock prioritised action plan <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ══ RECOMMENDED IMPROVEMENT PLAN PREVIEW ════════════════════════════ */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-secondary/60 border-b border-border/40">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recommended improvement plan</span>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border/50">
              Expected within 60–90 days
            </span>
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border/50">
              Confidence: Medium-High
            </span>
            <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-700/40">
              Balanced Growth Plan
            </span>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-foreground leading-relaxed mb-5">
            This plan improves profit without choking growth. It combines pricing discipline, marketing reallocation, stock control and overhead restraint.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Contribution / month", value: "+£42k",       color: "emerald" },
              { label: "Cash improvement",     value: "+£64k",       color: "emerald" },
              { label: "Runway extension",     value: "+0.8 months", color: "emerald" },
              { label: "Margin improvement",   value: "+4.2pp",      color: "emerald" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-secondary/40 rounded-xl p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                <p className={cn("text-base font-bold", color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-primary")}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <Link href="/scenario-lab" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
            Model this plan <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ══ KPI GRID ═════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPI_CARDS.map(kpi => (
          <div key={kpi.id} className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
            <p className="text-sm font-medium text-muted-foreground mb-1">{kpi.title}</p>
            <p className="text-2xl font-display font-bold text-foreground mb-2">{kpi.value}</p>
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-2",
              kpi.status === "positive" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
              : kpi.status === "warning"  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
              : kpi.status === "danger"   ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
              : "bg-secondary text-muted-foreground"
            )}>
              {kpi.status === "positive" && <ArrowUpRight className="w-3 h-3" />}
              {kpi.status === "danger"   && <ArrowDownRight className="w-3 h-3" />}
              {kpi.status === "warning"  && <Minus className="w-3 h-3" />}
              {kpi.change}
            </span>
            <p className="text-xs text-muted-foreground/80 leading-snug border-t border-border/50 pt-2">{kpi.text}</p>
          </div>
        ))}
      </div>

      {/* ══ PRIORITY ACTIONS THIS MONTH ══════════════════════════════════════ */}
      <div className="mb-8">
        <div className="mb-5">
          <h3 className="font-bold text-xl text-foreground">Priority actions this month</h3>
          <p className="text-sm text-muted-foreground mt-0.5">The highest-impact actions your CFO would focus on first.</p>
          <div className="h-px bg-border/60 mt-3" />
        </div>

        {isPro ? (
          /* ── Pro: all 3 actions, fully unlocked ─────────────────────────── */
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              {PRIORITY_ACTIONS.map(action => (
                <div key={action.title} className={cn(
                  "bg-card rounded-2xl p-5 shadow-sm border",
                  action.color === "red"    ? "border-rose-200/60 dark:border-rose-800/30"
                  : action.color === "orange" ? "border-orange-200/60 dark:border-orange-800/30"
                  : "border-border/50"
                )}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={cn(
                      "text-[11px] font-bold px-2.5 py-1 rounded-full",
                      action.color === "red"    ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                      : action.color === "orange" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                      : "bg-secondary text-muted-foreground"
                    )}>
                      {action.badge}
                    </span>
                    <TimingBadge timing={action.timing} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1.5 leading-snug">{action.title}</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2">{action.impact}</p>
                  <p className="text-xs text-muted-foreground leading-snug mb-4">{action.reason}</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                    <Link href="/scenario-lab" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                      Model impact <ArrowRight className="w-3 h-3" />
                    </Link>
                    <span className="inline-flex items-center text-xs font-medium text-muted-foreground/50 cursor-default select-none border border-border/40 rounded-md px-2 py-0.5">
                      Mark as done
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/profit-opportunities" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
              View full action plan <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        ) : (
          /* ── Free: action 1 visible, actions 2+3 locked ─────────────────── */
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              {/* Action 1 — fully visible */}
              {(() => {
                const action = PRIORITY_ACTIONS[0];
                return (
                  <div className="bg-card rounded-2xl p-5 shadow-sm border border-rose-200/60 dark:border-rose-800/30">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                        {action.badge}
                      </span>
                      <TimingBadge timing={action.timing} />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1.5 leading-snug">{action.title}</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2">{action.impact}</p>
                    <p className="text-xs text-muted-foreground leading-snug mb-4">{action.reason}</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary/50 cursor-default select-none">
                        Model impact <ArrowRight className="w-3 h-3" />
                      </span>
                      <span className="inline-flex items-center text-xs font-medium text-muted-foreground/50 cursor-default select-none border border-border/40 rounded-md px-2 py-0.5">
                        Mark as done
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Actions 2 & 3 — blurred/locked */}
              {PRIORITY_ACTIONS.slice(1).map(action => (
                <div key={action.title} className={cn(
                  "bg-card rounded-2xl p-5 shadow-sm border relative select-none pointer-events-none",
                  action.color === "red"    ? "border-rose-200/30 dark:border-rose-800/15"
                  : "border-orange-200/30 dark:border-orange-800/15"
                )}>
                  <div className="absolute inset-0 rounded-2xl bg-card/60 backdrop-blur-[3px] z-10 flex items-center justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/50">
                      <Lock className="w-3 h-3 text-muted-foreground/60" />
                      <span className="text-[11px] font-semibold text-muted-foreground/60">Pro only</span>
                    </div>
                  </div>
                  <div className="blur-[3px] opacity-50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn(
                        "text-[11px] font-bold px-2.5 py-1 rounded-full",
                        action.color === "red"    ? "bg-rose-100 text-rose-700"
                        : "bg-orange-100 text-orange-600"
                      )}>
                        {action.badge}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1.5 leading-snug">{action.title}</p>
                    <p className="text-xs font-bold text-emerald-600 mb-2">{action.impact}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{action.reason}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm text-muted-foreground">
                2 more priority actions available on Pro.
              </p>
              <a href="/upgrade" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap">
                <Lock className="w-3.5 h-3.5" /> Unlock full prioritised action plan <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </>
        )}
      </div>

      {/* ══ WHAT CHANGED AND WHY IT MATTERS ══════════════════════════════════ */}
      <TopDrivers
        drivers={TOP_DRIVERS}
        isPro={hasDriverDetail}
        title="What changed and why it matters"
        subtitle="The biggest movements behind this month's financial performance."
      />

      {/* ══ FREE UPGRADE PROMPT ═══════════════════════════════════════════════ */}
      {!isPro && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5 rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/80 dark:bg-indigo-950/30 mb-8">
          <div className="flex-1">
            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200 mb-1">Upgrade to Pro to unlock the full CFO action plan</p>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-snug">
              Unlock scenario modelling, detailed opportunity breakdown, quantified action impact and monthly CFO report.
            </p>
          </div>
          <a href="/upgrade" className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-md shadow-indigo-500/20">
            Upgrade to Pro <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* ══ EXPLORE THE DETAILED ENGINES ═════════════════════════════════════ */}
      <div className="mb-8">
        <div className="mb-5">
          <h3 className="font-bold text-xl text-foreground">Explore the detailed engines</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Go deeper on the areas driving profit, cash and growth quality.</p>
          <div className="h-px bg-border/60 mt-3" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HEALTH_MODULES.map(mod => (
            <Link
              key={mod.id}
              href={mod.href}
              className="bg-card rounded-2xl p-5 border border-border/50 hover:border-primary/30 hover:shadow-md transition-all group block"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{mod.title}</p>
              <p className="text-base font-bold text-foreground mb-1.5 leading-snug">{mod.headline}</p>
              <p className="text-xs text-muted-foreground leading-snug mb-4">{mod.subtitle}</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                {mod.cta} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <DataBenchmarkAssumptions
        benchmarkNote="Dashboard insights combine sales, marketing, pricing, margin and cash data."
        dataQualityNote="Accuracy improves as source data mappings improve."
        className="mb-2"
      />

    </AppLayout>
  );
}
