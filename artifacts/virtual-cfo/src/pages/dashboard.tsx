import { useActiveStore } from "@/lib/auth/AuthProvider";
import { getTradingMetrics } from "@/lib/analytics/getTradingMetrics";
import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, ArrowDownRight, Minus, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BriefingDataState } from "@/components/BriefingDataState";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";
import { TimelineSelector } from "@/components/TimelineSelector";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import { useBriefingComparison } from "@/lib/analytics/useBriefingComparison";
import { buildBriefing } from "@/lib/analytics/briefing";
import { useTimeline } from "@/lib/timeline";
import { canAccess } from "@/lib/plan";

// Demo store only. Customer authentication and store isolation remain sprint work.

const ANALYSIS_PAGES = [
  ["Margin Recovery", "Explore the components of contribution and margin.", "/margin-analysis"],
  ["Growth Quality", "Examine sales mix and repeat purchasing.", "/growth-quality"],
  ["Growth Efficiency", "Explore acquisition and channel performance.", "/marketing-efficiency"],
  ["Discount Recovery", "Review discounting and pricing scenarios.", "/pricing-optimisation"],
  ["Cash Control", "Explore cash assumptions and scenarios.", "/cash-control"],
  ["Profit Launchpad", "Explore possible plans and their assumptions.", "/scenario-lab"],
];

export default function Dashboard() {
  const STORE_ID = useActiveStore();
  const period = useLatestDataPeriod(STORE_ID, getTradingMetrics);
  const { timeline } = useTimeline();
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const historicalKey = `${timeline}:${period.dateFrom}`;
  const historicalPreview = period.status === "stale" && previewKey === historicalKey;
  const canBuildBriefing = period.status === "ready" || historicalPreview;
  const comparison = useBriefingComparison(STORE_ID, period.dateFrom, timeline, canBuildBriefing);
  const hasFullActionPlan = canAccess("dashboard_full_action_plan");
  const briefing = period.phase1 && canBuildBriefing
    ? buildBriefing(period.phase1.data, comparison.data, comparison.status) : null;

  return <AppLayout showMonitoring={false}>
    <div className="mb-5 flex flex-col sm:flex-row justify-between items-start gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CFO Briefing</h1>
        <p className="text-muted-foreground mt-1 text-sm">What the trading data shows, what changed, and where to look next.</p>
        {briefing && <DataPeriodLabel periodLabel={period.periodLabel} loading={false} status={period.status} dateFrom={period.dateFrom} dateTo={period.dateTo} />}
      </div>
      <TimelineSelector />
    </div>

    <p className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Test store · This briefing uses development data. Connected figures and financial definitions are still being reconciled.</p>

    {period.status === "stale" && <div className="mb-5 flex flex-wrap items-center gap-3">
      <button type="button" className="rounded-lg border border-primary/40 px-4 py-2 text-sm font-semibold text-primary" onClick={() => setPreviewKey(historicalPreview ? null : historicalKey)}>
        {historicalPreview ? "Close historical test preview" : "Preview briefing with historical test data"}
      </button>
      {historicalPreview && <span className="text-sm text-muted-foreground">Historical test preview · conclusions apply to {period.periodLabel}, not current trading.</span>}
    </div>}

    {!briefing ? <BriefingDataState period={period} /> : <>
      <section className="bg-card rounded-2xl border border-border shadow-sm mb-7 p-6 sm:p-7" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">This period's read</p>
        <h2 className="text-2xl font-bold mb-3">{briefing.headline}</h2>
        <p className="text-foreground/85 max-w-4xl leading-relaxed">{briefing.summary}</p>
        <div className="mt-5 pt-4 border-t border-border text-sm text-muted-foreground">
          {briefing.comparisonNote}
          {comparison.status === "ready" && <span> · {comparison.period.label}: {comparison.period.dateFrom} – {comparison.period.dateTo}</span>}
        </div>
      </section>

      <section className="sc-purple rounded-2xl mb-7 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-2 px-6 py-4">
          <Search className="w-4 h-4 text-indigo-300" />
          <h2 className="text-sm font-semibold text-indigo-100">Where to look next</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4">These are changes to investigate. Their causes and financial impact have not yet been established.</p>
          {briefing.signals.length ? <div className="divide-y divide-indigo-800/35">
            {briefing.signals.map(signal => <div key={signal.title} className="py-4 first:pt-0">
              <h3 className="font-semibold">{signal.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{signal.evidence}</p>
              <Link href={hasFullActionPlan ? signal.href : "/upgrade"} className="inline-flex gap-1 items-center text-sm text-primary mt-3">
                {hasFullActionPlan ? "Open analysis" : "Explore Pro analysis"}<ArrowRight className="w-3 h-3" />
              </Link>
            </div>)}
          </div> : <p className="text-sm">{comparison.status === "ready"
            ? "No increases in discount or refund rates, or decreases in net sales or repeat purchase rate, were found in this comparison. This is not an assessment of overall business health."
            : "A previous-period comparison is needed before highlighting changes to investigate."}</p>}
        </div>
      </section>

      <section className="mb-7">
        <h2 className="text-lg font-bold mb-1">Key numbers behind the briefing</h2>
        <p className="text-sm text-muted-foreground mb-5">Figures and comparisons use the same reporting periods as the briefing.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {briefing.metrics.map(metric => <div key={metric.id} className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-sm text-muted-foreground">{metric.title}</h3>
            <p className="text-2xl font-bold mt-2 mb-3">{metric.value}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              {metric.direction === "up" ? <ArrowUpRight className="w-3 h-3" />
                : metric.direction === "down" ? <ArrowDownRight className="w-3 h-3" />
                : metric.direction === "flat" ? <Minus className="w-3 h-3" /> : null}
              {metric.change}
            </p>
            <p className="border-t border-border pt-3 text-xs text-muted-foreground leading-relaxed">{metric.explanation}</p>
          </div>)}
        </div>
      </section>

      <section className="mb-7 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-bold text-lg">Financial estimates awaiting verification</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-4xl">Contribution margin and profit need a reconciled product-cost and overhead basis. Cash runway needs a dated cash balance and matching expense period. Recoverable profit and cash-release opportunities need separate, supported estimates. These figures are not included in this briefing yet.</p>
        <p className="text-sm text-muted-foreground mt-3">Automated monitoring is not active. Weekly trading comparisons cover orders only; they do not establish weekly profit or cash performance.</p>
      </section>

      <section className="mb-7">
        <h2 className="text-lg font-bold mb-2">Go deeper</h2>
        <p className="text-sm text-muted-foreground mb-4">The analysis pages still include prototype scenarios and assumptions. Check their data basis before using any estimated impact.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ANALYSIS_PAGES.map(([title, description, href]) => <Link key={href} href={hasFullActionPlan ? href : "/upgrade"} className="border-t border-border pt-4 group">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-3">{description}</p>
            <span className="text-sm text-primary inline-flex items-center gap-1">{hasFullActionPlan ? "Open analysis" : "Explore Pro analysis"}<ArrowRight className="w-3 h-3" /></span>
          </Link>)}
        </div>
      </section>
    </>}
  </AppLayout>;
}
