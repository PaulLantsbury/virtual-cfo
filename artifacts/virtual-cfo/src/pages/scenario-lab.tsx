import { useEffect, useState } from "react";
import { RefreshCw, Save, Layers } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AppLayout } from "@/components/layout/AppLayout";
import { canAccess } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { computeScenario, ZERO_SCENARIO_STATE } from "@/lib/scenario-model";

type ScenarioState = typeof ZERO_SCENARIO_STATE;
type Model = ReturnType<typeof computeScenario>;
const money = (value: number) => `${value < 0 ? "−" : ""}£${Math.abs(value).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
function changeText(value: number, baseline: number) {
  const delta = value - baseline;
  const percentage = baseline > 0
    ? ` (${delta < 0 ? "−" : delta > 0 ? "+" : ""}${(Math.abs(delta) / baseline * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%)`
    : " (percentage unavailable)";
  return `${delta > 0 ? "+" : ""}${money(delta)}${percentage}`;
}
function BusinessImpact({ model, title, sticky = false }: { model: Model; title: string; sticky?: boolean }) {
  return (
    <section aria-label={title} className={cn("rounded-xl border border-primary/30 bg-card p-3 sm:p-4", sticky && "sticky top-0 z-20 shadow-md mb-5")}>
      <h2 className="text-sm font-bold">{title}</h2>
      <p className="text-xs text-muted-foreground mt-1 mb-3">Compared with the sample starting position · one sample month · GBP</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-live="polite" aria-atomic="true">
        {[
          { label: "Sales", baseline: model.baseline.sales, value: model.result.sales },
          { label: "Contribution", baseline: model.baseline.contribution, value: model.result.contribution },
          { label: "Operating profit", baseline: model.baseline.operatingProfit, value: model.result.operatingProfit },
        ].map(({ label, baseline, value }) => (
          <div key={label} role="group" aria-label={label} className="min-w-0 rounded-lg bg-secondary/40 p-1.5 sm:p-3">
            <h3 className="text-xs font-semibold">{label}</h3>
            <p className="text-xs text-muted-foreground mt-2">Your scenario</p>
            <p className="text-sm sm:text-2xl font-bold tabular-nums">{money(value)}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">Sample starting position <span className="tabular-nums">{money(baseline)}</span></p>
            <p className={cn("text-[11px] sm:text-sm font-semibold tabular-nums mt-2", value > baseline ? "text-emerald-600 dark:text-emerald-400" : value < baseline ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
              Change: {changeText(value, baseline)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Sales = net product sales, excluding VAT and shipping. Contribution is after marketing. Sample arithmetic, not a forecast.</p>
    </section>
  );
}
function SliderRow({ label, value, min, max, step = 1, unit = "%", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-3 border-b border-border/40 last:border-0">
      <p className="text-sm font-medium flex-1 min-w-0">{label}</p>
      <div className="flex items-center gap-3 shrink-0 w-full sm:w-72">
        <Slider aria-label={label} value={[value]} min={min} max={max} step={step}
          onValueChange={([v]) => onChange(v)} className="flex-1" />
        <span className="text-sm font-semibold tabular-nums min-w-[64px] text-right">
          {value > 0 ? "+" : value < 0 ? "−" : ""}{unit === "£" ? "£" : ""}{Math.abs(value)}{unit === "£" ? "" : unit}
        </span>
      </div>
    </div>
  );
}
export default function ScenarioLab() {
  const isPro = canAccess("scenario_lab_builder");
  const [scenario, setScenario] = useState<ScenarioState>({ ...ZERO_SCENARIO_STATE });
  const [activeTab, setActiveTab] = useState("Growth");
  const [previousPreset, setPreviousPreset] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("preset")) {
      setPreviousPreset(true);
      url.searchParams.delete("preset");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
  const model = computeScenario(scenario);
  const set = (key: keyof ScenarioState) => (v: number) => setScenario(prev => ({ ...prev, [key]: v }));
  const controls = {
    Growth: [
      { key: "orderVolumeChange", label: "Order Volume Change", min: -20, max: 30 },
      { key: "aovChange", label: "Average Order Value Change", min: -10, max: 15 },
    ],
    Costs: [
      { key: "shippingChange", label: "Shipping Cost per Order Change", min: -3, max: 3, step: 0.5, unit: "£" },
      { key: "paymentFeeChange", label: "Payment Cost per Order Change", min: -2, max: 2, step: 0.5, unit: "£" },
      { key: "marketingSpendChange", label: "Marketing Spend Change", min: -30, max: 30 },
      { key: "fulfilmentChange", label: "Fulfilment Cost Change", min: -20, max: 20 },
    ],
    Overheads: [
      { key: "staffCostChange", label: "Staff Cost Change", min: -15, max: 20 },
      { key: "softwareChange", label: "Software Cost Change", min: -20, max: 20 },
      { key: "fixedCostChange", label: "Other Overhead Cost Change", min: -20, max: 20 },
    ],
  } satisfies Record<string, Array<{ key: keyof ScenarioState; label: string; min: number; max: number; step?: number; unit?: string }>>;
  const rows = [
    ["Gross product sales", "grossProductSales"], ["Discounts", "discounts"], ["Product refunds in the month", "productRefunds"],
    ["Sales", "sales"], ["Net shipping revenue", "shippingRevenue"], ["Net cost of goods sold", "cogs"],
    ["Gross profit", "grossProfit"], ["Variable operating costs", "variableCosts"], ["Marketing expenditure", "marketing"],
    ["Contribution", "contribution"], ["Operating overheads including depreciation", "overheads"],
    ["Depreciation and amortisation (included above)", "depreciationAmortisation"], ["Operating profit", "operatingProfit"], ["EBITDA", "ebitda"],
  ] as const;
  return (
    <AppLayout showMonitoring={false}>
      <div className="max-w-5xl mx-auto px-2 sm:px-6 py-8 space-y-6">
        <header><h1 className="text-3xl font-display font-bold">Scenario Planner</h1>
          <p className="text-sm text-muted-foreground mt-2">See how your assumptions change sales and operating profit in one consistent sample month.</p></header>
        <section aria-label="Scenario planning status" className="rounded-xl border border-amber-300 bg-amber-50/40 p-4 space-y-2">
          <h2 className="font-bold">Actual scenario planning: unavailable</h2>
          <p className="text-sm">No store financial data is connected. These are fixed GBP examples for a single synthetic month, not your store’s results.</p>
          <p className="text-sm">Sales is calculated from orders and average order value, less the month’s fixed product refunds. Changing AOV does not predict customer demand; changing marketing spend changes its cost only.</p>
          <p className="text-sm">Cash forecasts, runway, channel-driven growth and discount/refund response modelling are unavailable until their assumptions are agreed. Saving and comparing plans are unavailable.</p>
        </section>
        {previousPreset && <p role="status" className="rounded-xl border border-border p-4 text-sm"><strong>Previous preset not applied.</strong> Opportunity Finder’s older presets use assumptions that this corrected model does not support. Start from the sample baseline below; no partial preset has been loaded.</p>}
        {isPro ? <>
          <BusinessImpact model={model} title="Scenario summary" />
          <section className="rounded-2xl border border-border/50 bg-card p-3 sm:p-6" aria-label="Scenario controls">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h2 className="text-xl font-bold">Scenario Planner Simulator</h2>
              <button onClick={() => setScenario({ ...ZERO_SCENARIO_STATE })} className="inline-flex gap-2 items-center border border-border rounded-lg px-3 py-2 text-sm"><RefreshCw className="w-4 h-4" />Reset</button>
            </div>
            <BusinessImpact model={model} title="Live business impact" sticky />
            <div className="flex gap-2 mb-4" aria-label="Input categories">
              {Object.keys(controls).map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-semibold", tab === activeTab ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{tab}</button>)}
            </div>
            {controls[activeTab as keyof typeof controls].map(({ key, ...control }) => <SliderRow key={key} {...control} value={scenario[key]} onChange={set(key)} />)}
            <p className="text-xs text-muted-foreground mt-4">Orders are rounded to whole orders. AOV is after discounts and before later refunds. Other overheads exclude staff, software and depreciation, so these controls do not overlap.</p>
            <div className="flex flex-wrap gap-3 mt-5">
              <button disabled className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Save className="w-4 h-4" />Saving unavailable</button>
              <button disabled className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Layers className="w-4 h-4" />Comparison unavailable</button>
            </div>
          </section>
          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer"><h2 className="inline text-lg font-bold">Supporting Sample Analysis</h2></summary>
            <p className="text-sm text-muted-foreground my-3">Same calculation as the headline cards. Costs are shown as positive deductions. All amounts exclude VAT and refer to the same sample month.</p>
            <div className="overflow-x-auto"><table className="w-full text-xs sm:text-sm">
              <thead><tr><th className="text-left py-2">Metric</th><th className="text-right px-2">Sample starting position</th><th className="text-right px-2">Your scenario</th><th className="text-right">Change</th></tr></thead>
              <tbody>{rows.map(([label, key]) => <tr key={key} className="border-t border-border/50"><th className="text-left py-2 font-medium">{label}</th><td className="text-right px-2 tabular-nums">{money(model.baseline[key])}</td><td className="text-right px-2 tabular-nums">{money(model.result[key])}</td><td className="text-right tabular-nums">{changeText(model.result[key], model.baseline[key])}</td></tr>)}</tbody>
            </table></div>
          </details>
          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer font-bold">Sample inputs and assumptions</summary>
            <ul className="list-disc pl-5 space-y-2 mt-3 text-sm">
              <li>1,000 eligible original orders, £125 product value before discount per order, 20% discount and £100 AOV. Changing AOV scales the pre-discount basket value with the discount percentage held fixed; it is not a separate discount or price-demand forecast.</li>
              <li>£5,000 product refunds and £100 shipping refunds occur in this month and stay fixed when modelling new orders. Original orders remain counted. £2,000 of returned product cost is explicitly recoverable because those goods returned to saleable inventory.</li>
              <li>Per order: £40 historical product cost, £4 outbound shipping, £3 fulfilment and £2 payment processing. Shipping charged to customers is held at £3,000 for the month. Fixed product mix and per-order costs are synthetic assumptions; AOV changes do not automatically change them.</li>
              <li>£10,000 marketing spend; £12,000 staff, £2,000 software, £4,000 other overheads and £1,000 depreciation/amortisation. Every cost is counted once. EBITDA adds depreciation/amortisation back to operating profit.</li>
              <li>All values are invented test data excluding VAT. No currency conversion, tax estimate, automatic customer response or cash-conversion assumption is applied.</li>
            </ul>
          </details>
        </> : <p className="rounded-xl border border-border p-5">Pro previews the sample planner controls. Upgrading does not connect store data or activate forecasts.</p>}
      </div>
    </AppLayout>
  );
}
