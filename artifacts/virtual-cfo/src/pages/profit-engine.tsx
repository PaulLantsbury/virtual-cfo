import { useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, Lock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SimulatorSlider } from "@/components/SimulatorSlider";
import { cn } from "@/lib/utils";
import { canAccess } from "@/lib/plan";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import {
  ANNUAL_REVENUE as BASE_REVENUE,
  CONTRIBUTION,
  BASE_EBITDA,
} from "@/lib/data/business-snapshot";
import { MONTHLY_FIXED_COSTS as BASE_FIXED_COSTS } from "@/lib/data/cash-snapshot";

// ─── Base data constants ─────────────────────────────────────────────────────
// Values imported from central mock data layer (src/lib/data/business-snapshot.ts
// and src/lib/data/cash-snapshot.ts). Replace those files with live Xero/Shopify
// feeds when integrations are connected.
//
// BASE_REVENUE     = 520,000  (ANNUAL_REVENUE)
// CONTRIBUTION     = 198,000  (derived: net revenue − variable costs)
// BASE_FIXED_COSTS = 120,000  (MONTHLY_FIXED_COSTS from cash-snapshot)
// BASE_EBITDA      = 78,000   (derived: CONTRIBUTION − BASE_FIXED_COSTS)

// Derived percentages
const CONTRIBUTION_MARGIN_PCT   = CONTRIBUTION / BASE_REVENUE;                          // ≈ 38.08%

// ─── Bridge table rows ───────────────────────────────────────────────────────
const BRIDGE_TABLE = [
  { step: "Revenue",        amount:  520_000, pct:  100.0, meaning: "Gross sales before discounts and returns",              isTotal: false, isResult: false, positive: true  },
  { step: "Discounts",      amount: -82_000,  pct:  -15.8, meaning: "Discounting takes 15.8% off the top line",              isTotal: false, isResult: false, positive: false },
  { step: "Returns",        amount: -41_000,  pct:   -7.9, meaning: "Returned orders reduce revenue and add fulfilment cost", isTotal: false, isResult: false, positive: false },
  { step: "Net Revenue",    amount:  397_000, pct:   76.3, meaning: "Revenue remaining after discounts and returns",          isTotal: true,  isResult: false, positive: true  },
  { step: "Variable Costs", amount: -199_000, pct:  -38.3, meaning: "Product, fulfilment and payment processing costs",      isTotal: false, isResult: false, positive: false },
  { step: "Contribution",   amount:  198_000, pct:   38.0, meaning: "What remains to pay overheads and create profit",       isTotal: true,  isResult: false, positive: true  },
  { step: "Fixed Costs",    amount: -120_000, pct:  -23.1, meaning: "Payroll, software, rent and other overheads",           isTotal: false, isResult: false, positive: false },
  { step: "Profit",         amount:   78_000, pct:   15.0, meaning: "Illustrative remainder after sample fixed costs",             isTotal: true,  isResult: true,  positive: true  },
];

// ─── Driver data — corrected to net +£18,000 ────────────────────────────────
// Revenue growth (+9) + Better margin (+18) + Lower returns (+4) + Higher overheads (-13) = +18
const DRIVER_DATA = [
  { driver: "Revenue growth",   impact:  9_000,  explanation: "Sales growth added more contribution" },
  { driver: "Better margin",    impact: 18_000,  explanation: "Pricing, discounting and product mix improved" },
  { driver: "Lower returns",    impact:  4_000,  explanation: "Fewer returns protected net revenue" },
  { driver: "Higher overheads", impact: -13_000, explanation: "Payroll and software costs increased" },
];

const PROFIT_LOSS_AREAS = [
  {
    title: "Discounting",
    explanation: "Promotions are reducing retained profit.",
    value: 18_000,
    freeLabel: "Largest Opportunity",
  },
  {
    title: "Fixed Costs",
    explanation: "Overheads are rising faster than profit capacity.",
    value: 13_000,
    freeLabel: "Material Opportunity",
  },
  {
    title: "Returns & Leakage",
    explanation: "Returns and leakage reduce profit after the sale.",
    value: 4_000,
    freeLabel: "Secondary Opportunity",
  },
];

const PROFIT_GROWTH_ACTIONS = [
  {
    title: "Reduce discount dependency",
    impact: 18_000,
    confidence: "High",
    effort: "Low",
    timing: "Immediate",
    why: "Discounting is still reducing retained profit and weakening the quality of revenue growth.",
    start: "Set a tighter discount ceiling, remove blanket codes first, and monitor profit per order daily before widening the change.",
  },
  {
    title: "Improve contribution margin",
    impact: 12_000,
    confidence: "Medium",
    effort: "Medium",
    timing: "2-4 weeks",
    why: "More revenue needs to survive product, fulfilment and payment costs before it can become profit.",
    start: "Review the lowest-margin SKU and channel combinations, then shift spend toward products with stronger contribution per order.",
  },
  {
    title: "Slow overhead growth",
    impact: 13_000,
    confidence: "Medium",
    effort: "Low",
    timing: "1-2 weeks",
    why: "Rising fixed costs reduce operating leverage and make profit more sensitive to revenue slowdowns.",
    start: "Pause discretionary hiring and software additions, then review the two fastest-growing overhead lines for deferral or renegotiation.",
  },
  {
    title: "Improve returns performance",
    impact: 4_000,
    confidence: "Medium",
    effort: "Medium",
    timing: "3-6 weeks",
    why: "Returns reduce net revenue and add operational cost after the sale has already been made.",
    start: "Identify the highest-return SKUs, update sizing and product guidance, and route repeat return issues into merchandising review.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 0) =>
  (n < 0 ? "-" : "") + "£" + Math.abs(Math.round(n)).toLocaleString("en-GB", { maximumFractionDigits: decimals });

const fmtPct = (n: number, decimals = 1) => (n * 100).toFixed(decimals) + "%";

// ─── Sub-components ───────────────────────────────────────────────────────────

function InlineCfoInsight({ text }: { text: string }) {
  return (
    <div className="sc-purple rounded-xl px-4 py-3">
      <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider mb-1">Sample model explanation</p>
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Main page component ─────────────────────────────────────────────────────
export default function ProfitGrowth() {
  // Simulator state
  const [revChange,      setRevChange]      = useState(0);
  const [discountChange, setDiscountChange] = useState(0);
  const [returnsChange,  setReturnsChange]  = useState(0);
  const [varCostChange,  setVarCostChange]  = useState(0);
  const [fixedChange,    setFixedChange]    = useState(0);

  // Simulator calculations
  const adjRevenue       = BASE_REVENUE * (1 + revChange / 100);
  const adjContribMargin = CONTRIBUTION_MARGIN_PCT
                           - discountChange / 100
                           - returnsChange / 100
                           - varCostChange / 100;
  const projContrib      = adjRevenue * adjContribMargin;
  const projFixed        = BASE_FIXED_COSTS * (1 + fixedChange / 100);
  const projEBITDA       = projContrib - projFixed;
  const projEBITDAMargin = adjRevenue > 0 ? projEBITDA / adjRevenue : 0;
  const ebitdaMovement   = projEBITDA - BASE_EBITDA;

  const simInterpretation = projEBITDA < 0
    ? "This sample result is negative under the illustrative assumptions. It is not a business break-even assessment."
    : ebitdaMovement >= 0
      ? "This sample result is at or above the base result under the illustrative assumptions."
      : "This sample result is below the base result under the illustrative assumptions.";

  const simColor = projEBITDA < 0
    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400"
    : ebitdaMovement >= 0
      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
      : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400";

  const SimIcon = projEBITDA < 0 ? AlertTriangle : ebitdaMovement >= 0 ? TrendingUp : TrendingDown;

  return (
    <AppLayout showMonitoring={false}>
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Profit Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore an illustrative profit model while actual profit reporting is being built.
          </p>
        </div>

      </div>

      <section aria-label="Profit reporting status" className="rounded-xl border border-border bg-card p-5 mb-5">
        <h2 className="font-bold">Actual profit reporting: unavailable</h2>
        <p className="text-sm text-muted-foreground mt-2">This page has no connected profit or cost figures. Missing inputs are not zero profit. Reviewed sales alone cannot establish contribution, operating profit or EBITDA.</p>
      </section>
      <section aria-label="Sample profit model notice" className="rounded-xl border border-amber-300 bg-amber-50/10 p-5 mb-5">
        <h2 className="font-bold">Sample model — illustrative only</h2>
        <p className="text-sm text-muted-foreground mt-2">All figures below are fixed GBP examples, not your store's currency, results, opportunities or recommendations. Store selection does not change these examples.</p>
        <p className="text-sm text-muted-foreground mt-2">The original model combines an annual revenue example with monthly overhead inputs. Its period basis and cost definitions have not been reconciled to the agreed financial definitions. Outputs are sample arithmetic, not operating profit, EBITDA or a forecast. Example rankings, confidence and timing are not evidence-based; opportunity values may overlap and must not be added together.</p>
      </section>
      {/* ── 1. Sample Profit Summary ── */}
      <div className="sc-purple rounded-2xl shadow-md mb-5 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-3 px-6 py-3">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Sample Profit Summary</span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 whitespace-nowrap">Example only</span>
        </div>
        <div className="px-6 py-4">
          <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">Example: discounting and overheads can affect the amount left after costs.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 pb-3 border-b border-primary/15">
            <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Sample Opportunity</p>
              <p className="text-3xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">£18,000</p>
              <p className="text-xs text-emerald-700/75 dark:text-emerald-300/75 leading-snug mt-1">illustrative opportunity amount; not identified savings.</p>
            </div>
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Sample Base Result</p>
              <p className="text-xl font-display font-bold text-foreground leading-none">£{BASE_EBITDA.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-1">15% of the sample revenue input.</p>
            </div>
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Example Action</p>
              {canAccess("profit_recommendations") ? (
                <p className="text-sm font-bold text-foreground leading-snug">Reduce discount dependency before adding more overhead.</p>
              ) : (
                <p className="text-sm font-bold text-foreground leading-snug">Pro shows the sample action plan.</p>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">These fictional signals illustrate a possible summary; no profit trend or opportunity has been established for your store.</p>
          <div className="pt-3 flex flex-wrap gap-2">
            {["Discount leakage", "Overhead pressure", "Revenue quality"].map((signal) => (
              <span key={signal} className="rounded-full bg-secondary/30 border border-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground">{signal}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Sample Profit Leaks ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Sample Profit Leaks</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Fictional examples of potential loss areas; not measured or ranked for your store.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {PROFIT_LOSS_AREAS.map((area) => (
          <div key={area.title} className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Sample profit leak</p>
                <p className="text-sm font-semibold text-foreground leading-snug">{area.title}</p>
              </div>
              {canAccess("profit_recommendations") ? (
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">£{area.value.toLocaleString()}</p>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{area.freeLabel}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{area.explanation}</p>
            {!canAccess("profit_recommendations") && (
              <p className="text-xs text-primary font-semibold mt-2">Pro shows this sample value</p>
            )}
          </div>
        ))}
      </div>

      {/* ── 3. Sample Profit Growth Plan ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Sample Profit Growth Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Illustrative actions, rankings and impact estimates; not advice for your business.</p>
      </div>
      {canAccess("profit_recommendations") ? (
        <div className="space-y-4 mb-8">
          {PROFIT_GROWTH_ACTIONS.map((action, i) => (
            <details key={action.title} open={i === 0} className={cn("group rounded-2xl border bg-card shadow-sm overflow-hidden", i === 0 ? "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-border/60")}>
              <summary className={cn("list-none cursor-pointer px-6 py-5 transition-colors", i === 0 ? "hover:bg-emerald-50 dark:hover:bg-emerald-950/20" : "hover:bg-secondary/20")}>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-start">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={cn("flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-bold", i === 0 ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "bg-secondary text-muted-foreground")}>{i + 1}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-foreground">{action.title}</p>
                        {i === 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 uppercase tracking-wider">EXAMPLE PRIORITY</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">{action.why}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[auto_auto_auto_auto] gap-2 lg:justify-end">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-700/40 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Sample impact</p><p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">£{action.impact.toLocaleString()}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Example confidence</p><p className="text-sm font-semibold text-foreground">{action.confidence}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Example effort</p><p className="text-sm font-semibold text-foreground">{action.effort}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Example timing</p><p className="text-sm font-semibold text-foreground">{action.timing}</p></div>
                  </div>
                </div>
              </summary>
              <div className="px-6 pb-5 -mt-1"><div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 pl-11"><div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why it matters</p><p className="text-sm text-foreground leading-relaxed">{action.why}</p></div><div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">How to start</p><p className="text-sm text-foreground leading-relaxed">{action.start}</p></div></div></div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5"><div className="flex items-start gap-3"><div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0"><Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /></div><div><p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">View the Sample Profit Growth Plan</p><p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">Pro displays fictional priorities, timing, impact and implementation examples. Upgrading does not connect or validate actual profit reporting.</p></div></div></div>
      )}

      {/* ── 4. Profit Growth Simulator ── */}
      <div className="mb-2"><h2 className="text-xl font-bold text-foreground">Sample Profit Simulator</h2><p className="text-sm text-muted-foreground mt-0.5">Explore changes to fixed sample inputs. Results are illustrative arithmetic, not a validated business forecast.</p></div>
      {canAccess("profit_simulator") ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">

        <div className="mb-5">
          <InlineCfoInsight text="The sample responds to the five inputs below using fixed coefficients. It does not establish how your business would respond or support pricing, marketing or hiring decisions." />
        </div>

        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sliders */}
            <div className="space-y-6">
              <SimulatorSlider
                label="Revenue Change"
                value={revChange}
                min={-20} max={30} step={1}
                unit="%" showSign
                onChange={(v) => setRevChange(v)}
                description={`Sample adjusted revenue: ${fmt(adjRevenue)}`}
              />
              <SimulatorSlider
                label="Discount Rate Change"
                value={discountChange}
                min={-5} max={8} step={0.5}
                unit="pp" showSign
                onChange={(v) => setDiscountChange(v)}
                description="Impact on margin from discounting"
                positiveIsGood={false}
              />
              <SimulatorSlider
                label="Returns Rate Change"
                value={returnsChange}
                min={-5} max={5} step={0.5}
                unit="pp" showSign
                onChange={(v) => setReturnsChange(v)}
                description="Impact on margin from returns"
                positiveIsGood={false}
              />
              <SimulatorSlider
                label="Variable Cost Change"
                value={varCostChange}
                min={-5} max={5} step={0.5}
                unit="pp" showSign
                onChange={(v) => setVarCostChange(v)}
                description="Impact on margin from variable costs"
                positiveIsGood={false}
              />
              <SimulatorSlider
                label="Overhead Change"
                value={fixedChange}
                min={-20} max={20} step={1}
                unit="%" showSign
                onChange={(v) => setFixedChange(v)}
                description={`Sample adjusted overheads: ${fmt(projFixed)}`}
                positiveIsGood={false}
              />
            </div>

            {/* Results */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Sample Outcomes</h4>
              <div className="space-y-2">
                {[
                  { label: "Sample Revenue",                      value: fmt(adjRevenue),          highlight: false, isPeriod: false },
                  { label: "Sample Amount Before Overheads", value: fmt(projContrib),         highlight: false, isPeriod: false },
                  { label: "Sample Overheads",                    value: fmt(projFixed),            highlight: false, isPeriod: false },
                  { label: "Sample Result",                       value: fmt(projEBITDA),           highlight: true,  isPeriod: false },
                  { label: "Sample Movement vs Base",                value: "",                        highlight: true,  isPeriod: true  },
                  { label: "Sample Result / Revenue",                value: fmtPct(projEBITDAMargin),  highlight: false, isPeriod: false },
                ].map(({ label, value, highlight, isPeriod }) => (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5 rounded-xl",
                      highlight ? "bg-secondary/60 border border-border/50" : "bg-secondary/30",
                    )}
                  >
                    <span className={cn("text-xs", highlight ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {label}
                    </span>
                    {isPeriod ? (
                      <span className="text-sm font-bold tabular-nums">{fmt(ebitdaMovement)}</span>
                    ) : (
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        highlight
                          ? projEBITDA < 0
                            ? "text-red-600 dark:text-red-400"
                            : ebitdaMovement >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          : "text-foreground",
                      )}>
                        {value}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Interpretation */}
              <div className={cn("rounded-xl border px-4 py-3 mt-2 flex items-start gap-2.5", simColor)}>
                <SimIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">{simInterpretation}</p>
              </div>

              {/* Reset */}
              {(revChange !== 0 || discountChange !== 0 || returnsChange !== 0 || varCostChange !== 0 || fixedChange !== 0) && (
                <button
                  onClick={() => {
                    setRevChange(0);
                    setDiscountChange(0);
                    setReturnsChange(0);
                    setVarCostChange(0);
                    setFixedChange(0);
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline mt-1"
                >
                  Reset to base case
                </button>
              )}
            </div>
          </div>
        </div>

        </div>
      ) : (
        <div className="rounded-2xl border border-primary/20 bg-card shadow-sm mb-8 overflow-hidden"><div className="px-6 py-8 text-center"><div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-4"><Lock className="w-4 h-4 text-primary" /></div><p className="text-base font-semibold text-foreground mb-2">View the Sample Profit Simulator</p><p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">Explore fictional revenue and cost inputs. Pro does not provide a validated forecast or connect actual profit data.</p><a href="/upgrade" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">View Sample Simulator</a></div></div>
      )}

      <p className="text-sm text-muted-foreground mb-8">Store-specific profit advice is unavailable while the underlying analysis is unfinished.</p>

      {/* ── 6. Supporting Sample Analysis ── */}
      <details className="group bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">
        <summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Supporting Sample Analysis</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Fictional bridge, sensitivity, overhead, staff-efficiency and trend examples; not supporting evidence.</p>
            </div>
            <span className="text-xs font-semibold text-primary group-open:hidden">Expand</span>
            <span className="text-xs font-semibold text-primary hidden group-open:inline">Collapse</span>
          </div>
        </summary>
        <div className="px-6 pb-6 pt-2">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Sample profit bridge</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Example bridge: these static inputs illustrate deductions. They are not a reconciled profit statement.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-border/40">
                    {BRIDGE_TABLE.filter((row) => ["Revenue", "Discounts", "Returns", "Contribution", "Fixed Costs", "Profit"].includes(row.step)).map((row) => (
                      <tr key={row.step}>
                        <td className="py-2 pr-3 font-medium text-foreground">{row.step}</td>
                        <td className={cn("py-2 text-right font-semibold tabular-nums", row.amount < 0 ? "text-red-600 dark:text-red-400" : row.isResult ? "text-indigo-600 dark:text-indigo-400" : "text-foreground")}>
                          {canAccess("profit_driver_table")
                            ? row.amount < 0
                              ? `(£${Math.abs(row.amount).toLocaleString()})`
                              : `£${row.amount.toLocaleString()}`
                            : "Locked"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Sample sensitivity ranking</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Illustrative ordering only; impact and priority have not been calculated for your store.</p>
              <ol className="space-y-2">
                {(canAccess("profit_recommendations")
                  ? PROFIT_GROWTH_ACTIONS.map((item) => ({ title: item.title, impact: item.impact }))
                  : [
                      { title: "Revenue Quality", impact: null },
                      { title: "Cost Structure", impact: null },
                      { title: "Operational Efficiency", impact: null },
                      { title: "Customer Retention", impact: null },
                    ]
                ).map((item, i) => (
                  <li key={item.title} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-background border border-border/60 flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                    <span className="text-xs font-medium text-foreground">{item.title}</span>
                    <span className="ml-auto text-xs font-semibold text-foreground tabular-nums">
                      {item.impact !== null ? `£${item.impact.toLocaleString()}` : "Pro"}
                    </span>
                  </li>
                ))}
              </ol>
              {!canAccess("profit_recommendations") && (
                <p className="text-xs text-primary font-semibold mt-3">Pro shows example rankings and sample opportunity values.</p>
              )}
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Sample movement</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Fictional movement: margin and revenue gains partly offset by overhead growth.</p>
              <div className="space-y-2">
                {DRIVER_DATA.map((row) => (
                  <div key={row.driver} className="flex items-start gap-3">
                    <span className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", row.impact >= 0 ? "bg-emerald-500" : "bg-red-500")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-foreground">{row.driver}</p>
                        <span className={cn("text-xs font-semibold tabular-nums", row.impact >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {canAccess("profit_driver_table") ? row.impact >= 0 ? `+£${row.impact.toLocaleString()}` : `(£${Math.abs(row.impact).toLocaleString()})` : "Locked"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{row.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Sample staff cost efficiency</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Fictional staff-cost indicators, not measured efficiency or a detected trend.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { label: "Efficiency", value: "£2.80", note: canAccess("profit_staff_cost_trend") ? "per £1 staff cost" : "staff efficiency detail" },
                  { label: "Staff cost ratio", value: "18.5%", note: canAccess("profit_staff_cost_trend") ? "of revenue" : "overhead discipline" },
                  { label: "Trend", value: "Improving", note: canAccess("profit_staff_cost_trend") ? "4 periods" : "trend evidence" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-background/60 border border-border/50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-bold text-foreground mt-1">{canAccess("profit_staff_cost_trend") ? item.value : "Pro"}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </details>

      <DataBenchmarkAssumptions
        benchmarkNote="Thresholds, confidence, rankings and coefficients are unvalidated sample assumptions. They do not establish business health or actionable opportunities."
        dataQualityNote="No actual profit or cost data is connected here. The legacy period basis and profit definitions remain unreconciled; sample GBP amounts are not store currency or validated forecasts."
        className="mb-2"
      />

    </AppLayout>
  );
}
