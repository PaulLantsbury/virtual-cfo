import { useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, CircleHelp, FlaskConical, Lock, ShieldCheck, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useActiveStore } from "@/lib/auth/AuthProvider";
import { useSalesReporting } from "@/lib/analytics/useSalesReporting";
import { SalesReportingPeriod } from "@/components/SalesReportingPeriod";
import { VerifiedSalesSummary } from "@/components/VerifiedSalesSummary";
import { canAccess } from "@/lib/plan";

// Approved 19 November design revision. All fixtures below are independent of merchant data.
// Advertising is the only marketing deduction here; agency, salaries and tools remain overheads.
type Verdict = "Scale" | "Hold" | "Pull back" | "Needs evidence";
type Example = "headroom" | "tight" | "loss" | "repeat";
export type MarketingInputs = {
  revenue: number; beforeAds: number; spend: number; orders: number; newCustomers: number;
  firstOrderContribution: number; acquisitionSpend: number; targetPoas: number;
  cashConfirmed: boolean; stockConfirmed: boolean; stable: boolean;
  repeatStrategy?: boolean; cohortContribution90?: number; cohortCac?: number; paybackDays?: number;
  maxPaybackDays?: number;
};
export function marketingDecision(input: MarketingInputs | null): { verdict: Verdict; reason: string } {
  if (!input) return { verdict: "Needs evidence", reason: "Connect and reconcile marketing spend, order costs and customer records before deciding." };
  const required = [input.revenue, input.beforeAds, input.spend, input.orders, input.newCustomers, input.firstOrderContribution, input.acquisitionSpend, input.targetPoas];
  if (!required.every(Number.isFinite) || input.revenue <= 0 || input.beforeAds <= 0 || input.spend <= 0 || input.orders <= 0 || input.newCustomers <= 0 || input.acquisitionSpend <= 0 || input.firstOrderContribution < 0 || input.targetPoas <= 1 || input.acquisitionSpend > input.spend)
    return { verdict: "Needs evidence", reason: "Reliable matched amounts, positive denominators and a target above advertising break-even are required." };
  const cac = input.acquisitionSpend / input.newCustomers;
  const poas = input.beforeAds / input.spend;
  if (poas <= 1) return { verdict: "Pull back", reason: "Advertising absorbs all contribution or more. Review and reduce loss-making activity before adding spend." };
  if (cac > input.firstOrderContribution) {
    const mature = [input.cohortContribution90, input.cohortCac, input.paybackDays, input.maxPaybackDays].every(value => typeof value === "number" && Number.isFinite(value) && value > 0);
    if (!input.repeatStrategy || !mature) return { verdict: "Needs evidence", reason: "First orders do not recover acquisition cost. Verify mature repeat-purchase contribution, payback and funding before deciding." };
    if (input.cohortContribution90! <= input.cohortCac! || input.paybackDays! > input.maxPaybackDays!) return { verdict: "Pull back", reason: "First-order losses are not supported by the agreed mature-cohort recovery and payback requirements." };
    return { verdict: "Hold", reason: "Mature customers recover acquisition cost, but first orders need funding. Confirm current-cohort performance and cash before any increase." };
  }
  if (poas < input.targetPoas) return { verdict: "Pull back", reason: "Advertising is contribution-positive but below the agreed target. Fix the weakest activity and reduce it where needed." };
  if (!input.cashConfirmed || !input.stockConfirmed) return { verdict: "Needs evidence", reason: "Profitable acquisition alone does not confirm affordability. Cash commitments, reserves and stock capacity need checking." };
  if (cac > input.firstOrderContribution / input.targetPoas) return { verdict: "Hold", reason: "Blended advertising clears its target, but first-order acquisition does not yet meet the example return requirement. Improve acquisition headroom before increasing spend." };
  if (!input.stable || poas < input.targetPoas * 1.15) return { verdict: "Hold", reason: "Acquisition is profitable, but headroom is limited or costs are worsening. Protect contribution before increasing spend." };
  return { verdict: "Scale", reason: "Contribution clears the example target, economics are stable, and cash and stock checks pass. Test a bounded increase and review the extra contribution." };
}
const BASE: MarketingInputs = { revenue: 100000, beforeAds: 40000, spend: 20000, orders: 2000, newCustomers: 1000, firstOrderContribution: 20, acquisitionSpend: 16000, targetPoas: 1.8, cashConfirmed: true, stockConfirmed: true, stable: false };
const EXAMPLES: Record<Example, { name: string; data: MarketingInputs; cac: number[]; poas: number[] }> = {
  tight: { name: "Hold · limited headroom", data: BASE, cac: [12, 13, 14, 15, 15.5, 16], poas: [2.5, 2.4, 2.3, 2.2, 2.1, 2] },
  headroom: { name: "Scale · strong economics", data: { ...BASE, spend: 16000, acquisitionSpend: 10000, stable: true }, cac: [11, 10.8, 10.5, 10.2, 10, 10], poas: [2.2, 2.3, 2.35, 2.4, 2.45, 2.5] },
  loss: { name: "Pull back · losses after ads", data: { ...BASE, spend: 45000, acquisitionSpend: 35000 }, cac: [20, 22, 25, 28, 32, 35], poas: [1.6, 1.4, 1.3, 1.15, 1.02, 40000 / 45000] },
  repeat: { name: "Hold · repeat-purchase strategy", data: { ...BASE, revenue: 150000, beforeAds: 60000, spend: 30000, acquisitionSpend: 26000, repeatStrategy: true, cohortContribution90: 44, cohortCac: 26, paybackDays: 55, maxPaybackDays: 60 }, cac: [22, 23, 24, 25, 25.5, 26], poas: [2.3, 2.25, 2.2, 2.1, 2.05, 2] },
};
const money = (value: number, digits = 0) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const ratio = (value: number) => `${value.toFixed(2)}×`;
const panel = "rounded-2xl border border-border/60 bg-card p-5 sm:p-6";
const tone: Record<Verdict, string> = { Scale: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30", Hold: "text-amber-500 bg-amber-500/10 border-amber-500/30", "Pull back": "text-rose-500 bg-rose-500/10 border-rose-500/30", "Needs evidence": "text-muted-foreground bg-secondary border-border" };
function Disclosure({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return <details id={id} className={`${panel} group`}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{title}<ChevronDown aria-hidden className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary><div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div></details>;
}
function Trend({ values, target, title, unit }: { values: number[]; target: number; title: string; unit: "money" | "ratio" }) {
  const max = Math.max(...values, target) * 1.2;
  const y = (v: number) => 105 - v / max * 85;
  const format = (v: number) => unit === "money" ? money(v, 2) : ratio(v);
  return <div><div className="flex justify-between gap-3 text-sm"><span className="font-medium">{title}</span><strong>{format(values[values.length - 1])}</strong></div>
    <svg viewBox="0 0 340 135" role="img" aria-label={`${title}: ${values.map(format).join(", ")}. Reference ${format(target)}.`} className="mt-2 w-full overflow-visible">
      {[25, 65, 105].map(v => <line key={v} x1="12" x2="328" y1={v} y2={v} stroke="currentColor" opacity="0.10" />)}
      <line x1="12" x2="328" y1={y(target)} y2={y(target)} stroke="#f59e0b" strokeDasharray="5 5" />
      <polyline fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round" points={values.map((v, i) => `${12 + i * 63.2},${y(v)}`).join(" ")} />
      {values.map((v, i) => <circle key={i} cx={12 + i * 63.2} cy={y(v)} r="3.5" fill="#38bdf8" />)}
      <text x="12" y="128" fill="currentColor" fontSize="12">Week 1</text><text x="285" y="128" fill="currentColor" fontSize="12">Week 6</text>
    </svg><p className="text-sm text-muted-foreground">Dashed: {unit === "money" ? "first-order contribution before ads" : "example POAS target"} · {format(target)}</p>
    <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer">View weekly values</summary><table className="mt-2 w-full text-left"><caption className="sr-only">Fictional weekly {title}</caption><thead><tr><th scope="col">Week</th><th scope="col">{title}</th></tr></thead><tbody>{values.map((v, i) => <tr key={i}><td>{i + 1}</td><td>{format(v)}</td></tr>)}</tbody></table></details>
  </div>;
}
export function incrementalSpend(extra: number, lowCac: number, highCac: number, contribution: number) {
  if (![extra, lowCac, highCac, contribution].every(Number.isFinite) || extra < 0 || lowCac <= 0 || highCac < lowCac || contribution < 0) return null;
  return { customersLow: extra / highCac, customersHigh: extra / lowCac, profitLow: extra / highCac * contribution - extra, profitHigh: extra / lowCac * contribution - extra };
}
export function MarketingDecisionReview({ isPro }: { isPro: boolean }) {
  const [example, setExample] = useState<Example>("tight");
  const [extra, setExtra] = useState(1000);
  const [lowCac, setLowCac] = useState(18);
  const [highCac, setHighCac] = useState(24);
  const [reviewOpen, setReviewOpen] = useState(false);
  const fixture = EXAMPLES[example];
  const d = fixture.data;
  const decision = marketingDecision(d);
  const cac = d.acquisitionSpend / d.newCustomers;
  const poas = d.beforeAds / d.spend;
  const roas = d.revenue / d.spend;
  const margin = d.beforeAds / d.revenue;
  const left = d.firstOrderContribution - cac;
  const scenario = incrementalSpend(extra, lowCac, highCac, d.firstOrderContribution);
  const newRevenue = d.revenue * 0.4; // fixed sample composition, independent of customer counts
  const reviewTitle = decision.verdict === "Scale" ? "Plan a controlled test" : decision.verdict === "Pull back" ? "Review loss-making activity" : "Review the spending constraint";
  return <section aria-label="Fictional marketing design review" className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
      <div><p className="flex items-center gap-2 font-semibold text-sky-500"><FlaskConical className="h-4 w-4" aria-hidden />Fictional design review</p><p className="mt-1 text-sm text-muted-foreground">Fixed six-week example · GBP · independent of your store and reporting period.</p></div>
      <label className="space-y-1 text-sm"><span className="block text-muted-foreground">Review a decision</span><select value={example} onChange={event => { setExample(event.target.value as Example); setReviewOpen(false); setLowCac(event.target.value === "headroom" ? 9 : 18); setHighCac(event.target.value === "headroom" ? 11 : 24); }} className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground"><option value="tight">{EXAMPLES.tight.name}</option><option value="headroom">{EXAMPLES.headroom.name}</option><option value="loss">{EXAMPLES.loss.name}</option><option value="repeat">{EXAMPLES.repeat.name}</option></select></label>
    </div>
    <div className={`${panel} overflow-hidden border-l-4 ${decision.verdict === "Scale" ? "border-l-emerald-500" : decision.verdict === "Pull back" ? "border-l-rose-500" : "border-l-amber-500"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">The investment decision · example</p><span className={`rounded-full border px-4 py-1 text-sm font-bold ${tone[decision.verdict]}`}>{decision.verdict}</span></div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{decision.verdict === "Scale" ? "There’s room to test more spend." : decision.verdict === "Pull back" ? "Protect profit before buying more sales." : example === "repeat" ? "Repeat purchases carry the acquisition case." : "Profitable orders. Less room to scale."}</h2>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{decision.reason}</p>
      <div className="mt-5 flex flex-col justify-between gap-4 border-t border-border/50 pt-5 sm:flex-row sm:items-center"><p className="text-sm">First order: <strong>{money(d.firstOrderContribution, 2)}</strong> contribution − <strong>{money(cac, 2)}</strong> CAC = <strong className={left >= 0 ? "text-emerald-500" : "text-rose-500"}>{money(left, 2)}</strong> before overheads.</p>{isPro ? <button onClick={() => setReviewOpen(!reviewOpen)} aria-expanded={reviewOpen} aria-controls="marketing-test-review" className="shrink-0 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground">{reviewTitle}</button> : <p className="text-sm text-muted-foreground">Pro adds the test plan and spending model.</p>}</div>
      {reviewOpen && isPro && <div id="marketing-test-review" className="mt-5 rounded-xl bg-secondary/50 p-4 text-sm leading-relaxed"><h3 className="font-semibold">Example review plan</h3><ol className="mt-2 list-decimal space-y-2 pl-5"><li>{decision.verdict === "Scale" ? "Test an additional £1,000 over 14 days, only after funding and stock are confirmed." : decision.verdict === "Pull back" ? "Identify the campaigns below the contribution requirement; review reductions with the budget owner." : "Hold the example budget while checking the acquisition-cost trend and contribution by product."}</li><li>Check matched contribution and acquisition cost after seven days and at the 14-day review. Account for conversion lag and later returns.</li><li>Stop the increase if marginal CAC exceeds the agreed test ceiling, POAS falls below target, or cash or stock constraints appear.</li><li>Assign an owner and confirm cash commitments, reserve and acceptable payback before acting.</li></ol><p className="mt-3 text-muted-foreground">Illustrative plan only. Nothing is saved, scheduled or sent to advertising platforms.</p></div>}
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "New customer CAC", value: money(cac, 2), note: `First-order contribution ${money(d.firstOrderContribution, 2)}`, sub: `${money(left, 2)} left after acquisition`, good: left >= 0 },
        { label: "POAS · profit return", value: ratio(poas), note: `Example target ${ratio(d.targetPoas)}`, sub: `${money(poas, 2)} contribution per £1 of ads`, good: poas >= d.targetPoas },
        { label: "ROAS · sales return", value: ratio(roas), note: `Advertising break-even ${ratio(1 / margin)}`, sub: "Matched sales per £1 of ads", good: roas >= 1 / margin },
        { label: "Contribution after ads", value: money(d.beforeAds - d.spend), note: `${((d.beforeAds - d.spend) / d.revenue * 100).toFixed(1)}% of net revenue`, sub: "Available for overheads and profit", good: d.beforeAds > d.spend },
      ].map(card => <div key={card.label} className={panel}><h3 className="text-sm font-medium text-muted-foreground">{card.label}</h3><p className="mt-2 text-3xl font-bold tabular-nums">{card.value}</p><p className={`mt-3 text-sm font-medium ${card.good ? "text-emerald-500" : "text-rose-500"}`}>{card.note}</p><p className="mt-1 text-sm text-muted-foreground">{card.sub}</p></div>)}
    </div>
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className={panel}><h2 className="flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-5 w-5 text-sky-500" aria-hidden />Is spending headroom improving?</h2><p className="mt-1 text-sm text-muted-foreground">Six fictional weekly observations. Reference lines show where the room runs out.</p><div className="mt-6 grid gap-7 sm:grid-cols-2"><Trend values={fixture.cac} target={d.firstOrderContribution} title="New customer CAC" unit="money" /><Trend values={fixture.poas} target={d.targetPoas} title="POAS" unit="ratio" /></div></div>
      <div className={panel}><h2 className="text-lg font-semibold">What one first order leaves</h2><p className="mt-1 text-sm text-muted-foreground">Matched new customers · per first order</p><div className="mt-6 space-y-5">{[{ label: "Contribution before acquisition", value: d.firstOrderContribution, color: "bg-sky-400" }, { label: "Cost to acquire the customer", value: cac, color: "bg-violet-400" }].map(row => <div key={row.label}><div className="mb-2 flex justify-between gap-2 text-sm"><span>{row.label}</span><strong>{money(row.value, 2)}</strong></div><div className="h-3 rounded-full bg-secondary"><div className={`h-3 rounded-full ${row.color}`} style={{ width: `${row.value / Math.max(cac, d.firstOrderContribution) * 100}%` }} /></div></div>)}<div className="flex justify-between border-t border-border pt-4"><span>After acquisition</span><strong className={left >= 0 ? "text-emerald-500" : "text-rose-500"}>{money(left, 2)}</strong></div></div><p className="mt-5 text-sm text-muted-foreground">This is contribution, before overheads. It is not net profit or the cash funding requirement.</p></div>
    </div>
    <Disclosure title="What supports this decision?">
      <div className="grid gap-4 sm:grid-cols-3"><div><h3 className="font-semibold text-foreground">90-day contribution : CAC</h3><p className="mt-2 text-2xl font-bold text-foreground">{ratio(44 / 26)}</p><p>Separate mature fictional cohort · acquired April–June 2026, observed through 30 September. £44 contribution before acquisition / £26 matched CAC.</p></div><div><h3 className="font-semibold text-foreground">Observed CAC payback</h3><p className="mt-2 text-2xl font-bold text-foreground">55 days</p><p>Same mature cohort. Cumulative contribution recovers CAC. This is not a promise for current customers or a bank-cash forecast.</p></div><div><h3 className="font-semibold text-foreground">New / returning sales</h3><p className="mt-2 text-2xl font-bold text-foreground">40% / 60%</p><p>{money(newRevenue)} / {money(d.revenue - newRevenue)} of sample net revenue. The mix gives context; it does not establish profitability.</p></div></div>
      <p>Current acquisition and mature cohort evidence have different dates. The mature cohort supports the repeat-purchase example only; it does not automatically justify current spend.</p>
      <div className="rounded-lg border border-border p-4"><strong className="text-foreground">Before scaling:</strong> confirm dated cash commitments, reserve, stock capacity, acceptable payback and a responsible owner. Historical profit alone cannot confirm affordability. The example target of 1.80× and 15% headroom buffer are review assumptions, not universal benchmarks.</div>
    </Disclosure>
    <Disclosure title="Which paid activity needs attention?">
      <p>Illustrative channel comparison, separate from the six-week model above. Compare matched economics within each channel. Platform attribution is not proof of incremental sales.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><caption className="sr-only">Separate fictional paid-channel examples; totals do not reconcile to the main fixture</caption><thead className="text-foreground"><tr>{["Channel", "New CAC", "First-order contribution", "POAS", "ROAS", "Review"].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>{[{ name: "Google", spend: 6000, revenue: 30000, contribution: 13500, customers: 400, first: 22 }, { name: "Meta", spend: 8000, revenue: 32000, contribution: 12000, customers: 400, first: 20 }].map(c => <tr key={c.name} className="border-t border-border"><th scope="row" className="p-3 text-foreground">{c.name}</th><td className="p-3">{money(c.spend / c.customers, 2)}</td><td className="p-3">{money(c.first, 2)}</td><td className="p-3">{ratio(c.contribution / c.spend)}</td><td className="p-3">{ratio(c.revenue / c.spend)}</td><td className="p-3">{c.name === "Google" ? "Check capacity before testing" : "Review target and margin"}</td></tr>)}</tbody></table></div>
      <p>No automatic budget transfer follows this ranking. Email and Organic are supporting demand sources, not interchangeable destinations for paid-ad budgets. Channel revenue must not be summed where attribution overlaps.</p>
    </Disclosure>
    <div className={panel}><div className="flex items-start gap-3"><BarChart3 className="mt-1 h-5 w-5 shrink-0 text-sky-500" aria-hidden /><div><h2 className="text-lg font-semibold">What could another {money(extra)} of ads deliver?</h2><p className="mt-1 text-sm text-muted-foreground">A conditional 14-day acquisition test. Change the expected cost of the next customer, rather than assuming today’s average holds.</p></div></div>
      {isPro ? <><div className="mt-6 grid gap-4 sm:grid-cols-3">{[{ label: "Additional ad budget (£)", value: extra, set: setExtra, min: 0 }, { label: "Lower marginal CAC (£)", value: lowCac, set: setLowCac, min: 0.01 }, { label: "Upper marginal CAC (£)", value: highCac, set: setHighCac, min: 0.01 }].map(field => <label key={field.label} className="text-sm font-medium">{field.label}<input type="number" min={field.min} step={field.min === 0 ? 100 : 1} value={Number.isFinite(field.value) ? field.value : ""} onChange={e => field.set(e.target.value === "" ? NaN : Number(e.target.value))} className="mt-2 block w-full rounded-lg border border-border bg-background p-3 text-foreground" /></label>)}</div>
        <div aria-live="polite" className="mt-5">{scenario ? <div className="grid gap-4 rounded-xl bg-secondary/50 p-5 sm:grid-cols-3"><div><p className="text-sm text-muted-foreground">Additional customers / first orders</p><p className="mt-1 text-xl font-bold">{Math.floor(scenario.customersLow)}–{Math.ceil(scenario.customersHigh)}</p></div><div><p className="text-sm text-muted-foreground">Contribution after extra ads</p><p className={`mt-1 text-xl font-bold ${scenario.profitLow >= 0 ? "text-emerald-500" : "text-amber-500"}`}>{money(scenario.profitLow)} to {money(scenario.profitHigh)}</p></div><div><p className="text-sm text-muted-foreground">First-order target CAC ceiling</p><p className="mt-1 text-xl font-bold">{money(d.firstOrderContribution / d.targetPoas, 2)}</p></div></div> : <p role="alert" className="text-rose-500">Enter a non-negative budget and positive CAC bounds, with the upper bound at least the lower bound.</p>}</div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Assumes {money(d.firstOrderContribution, 2)} contribution before ads per additional first order and one order per new customer. The target ceiling is contribution ÷ target POAS; advertising break-even CAC is {money(d.firstOrderContribution, 2)}. These are first-order test limits, not a lifetime acquisition ceiling. Stock purchases, payment timing and cash payback are not modelled. The range is an assumption, not a confidence interval or forecast.</p><button className="mt-4 text-sm font-semibold text-primary underline underline-offset-4" onClick={() => { setExtra(1000); setLowCac(18); setHighCac(24); }}>Reset test assumptions</button></> : <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" aria-hidden />The interactive spending model is available in Pro. Definitions and evidence stay available below.</p>}
    </div>
    <Disclosure id="marketing-example-evidence" title="Explore the Numbers · example calculations">
      <p><strong className="text-foreground">Scope:</strong> fictional six-week GBP example, formula version marketing-decision-2026-11-19. No merchant sources, attribution or forecasting service are used. Weeks are separate observations; their ratios must not be averaged to derive period totals.</p>
      <dl className="grid gap-4 sm:grid-cols-2">{[
        ["POAS", `${money(d.beforeAds)} contribution before advertising ÷ ${money(d.spend)} advertising = ${ratio(poas)}.`],
        ["ROAS", `${money(d.revenue)} matched net revenue ÷ ${money(d.spend)} advertising = ${ratio(roas)}. Platform-reported ROAS must remain separately labelled when its scope differs.`],
        ["Contribution after advertising", `${money(d.beforeAds)} − ${money(d.spend)} = ${money(d.beforeAds - d.spend)}. Margin uses ${money(d.revenue)} net product and shipping revenue.`],
        ["New customer CAC", `${money(d.acquisitionSpend)} eligible acquisition spend ÷ ${d.newCustomers.toLocaleString()} first-time customers = ${money(cac, 2)}. This acquisition subset differs from total advertising spend.`],
        ["Order CPA", `${money(d.spend)} advertising ÷ ${d.orders.toLocaleString()} matched orders = ${money(d.spend / d.orders, 2)}. CPA includes repeat orders; it must not be compared with new-customer first-order contribution as if it were CAC.`],
        ["Advertising break-even ROAS", `1 ÷ ${(margin * 100).toFixed(1)}% contribution-before-ads margin = ${ratio(1 / margin)}. Target ROAS is ${ratio(d.targetPoas / margin)} on this same scope.`],
      ].map(([label, text]) => <div key={label}><dt className="font-semibold text-foreground">{label}</dt><dd className="mt-1">{text}</dd></div>)}</dl>
      <p>Net revenue excludes VAT and deducts discounts/refunds once. Contribution before ads = net product sales − COGS + net shipping revenue − variable operating costs, including payment fees, fulfilment, packaging, shipping and return handling. Agency fees, salaries and tools are overheads. Source reporting retains refund-event timing; customer cohorts retain original-order links with an explicit observation date.</p>
      <p>The fixture’s {money(d.beforeAds)} contribution is supported by {money(d.revenue - d.beforeAds - 15000)} COGS, {money(15000)} variable operating costs and zero net shipping revenue against {money(d.revenue)} net product sales. Costs are constructed examples. Missing actual costs would make actual POAS unavailable, never zero-cost profit.</p>
      <p><strong className="text-foreground">Decision rules:</strong> missing or invalid evidence → Needs evidence; POAS ≤1 → Pull back; an unsupported first-order deficit → Needs evidence; a supported but failed repeat-recovery requirement → Pull back; below the business POAS target → Pull back / fix; missing cash or stock checks → Needs evidence; first-order acquisition below the return target, worsening economics or less than 15% headroom above target → Hold; otherwise → Scale with a bounded test. No fixed universal payback or revenue-mix threshold is applied.</p>
    </Disclosure>
  </section>;
}
export default function MarketingEfficiency() {
  const storeId = useActiveStore();
  const reporting = useSalesReporting(storeId);
  const [showExample, setShowExample] = useState(false);
  const isPro = canAccess("marketing_budget_simulator");
  return <AppLayout showMonitoring={false}>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Marketing Efficiency</h1><p className="mt-2 text-muted-foreground">Know when to scale, hold or pull back.</p></div><a className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary" href="#marketing-source-evidence">Explore the Numbers</a></div>
    <section aria-label="Actual marketing decision" className={`${panel} mb-6`}><div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden />Your business · evidence status</div><div className="mt-3 flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">Can you profitably increase advertising?</h2><span className={`rounded-full border px-3 py-1 text-sm ${tone["Needs evidence"]}`}>Needs evidence</span></div><p className="mt-3 text-muted-foreground">Reconciled advertising spend, matched customer records and order costs are not yet supported here. Actual recommendations remain unavailable.</p><button onClick={() => setShowExample(!showExample)} aria-expanded={showExample} aria-controls="marketing-design-example" className="mt-5 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">{showExample ? "Close fictional design review" : "Review the redesigned example"}</button></section>
    {showExample && <div id="marketing-design-example" className="mb-6"><MarketingDecisionReview key={storeId} isPro={isPro} /></div>}
    <Disclosure id="marketing-source-evidence" title="Explore the Numbers · your source coverage"><p className="flex items-start gap-2"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Sales below follow your selected store and reporting period. They do not populate the independent fictional marketing review.</p><SalesReportingPeriod reporting={reporting} /><VerifiedSalesSummary reporting={reporting} /><p>Marketing decision status: unavailable. Advertising reconciliation, acquisition identity, matched contribution, attribution overlap, cash commitments and stock capacity have not been accepted on this page. No older snapshot or sample amount is substituted into actual results.</p></Disclosure>
  </AppLayout>;
}
