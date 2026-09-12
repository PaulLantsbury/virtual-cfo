import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Slider } from "@/components/ui/slider";
import { canAccess } from "@/lib/plan";
import {
  computeScenario, ZERO_SCENARIO_STATE, SCENARIO_CONTROL_RANGES,
  type ScenarioState, type ScenarioMetrics,
} from "@/lib/scenario-model";

const money = (value: number) => `${value < 0 ? "−" : ""}£${Math.abs(value).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
function changeText(value: number, baseline: number) {
  const delta = Math.round((value - baseline) * 100) / 100;
  const percentage = baseline > 0
    ? ` (${delta < 0 ? "−" : delta > 0 ? "+" : ""}${(Math.abs(delta) / baseline * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%)`
    : " (percentage unavailable)";
  return `${delta > 0 ? "+" : ""}${money(delta)}${percentage}`;
}
const headlineMetrics = [
  ["Sales", "sales"], ["Contribution", "contribution"], ["Operating profit", "operatingProfit"],
] as const;
const controls = [
  ["Order Volume Change", "orderVolumeChange"],
  ["Average Order Value Change", "aovChange"],
  ["Marketing Spend Change", "marketingSpendChange"],
  ["Other Overhead Cost Change", "fixedCostChange"],
] as const;
const bridgeRows: readonly [string, keyof ScenarioMetrics, number, string][] = [
  ["Gross product sales", "grossProductSales", 1, "Before product discounts and refunds, excluding VAT"],
  ["Discounts", "discounts", -1, "Product discounts deducted once"],
  ["Product sales before refunds", "productSalesBeforeRefunds", 1, "Original orders × pre-refund AOV"],
  ["Product refunds in the month", "productRefunds", -1, "Fixed refund events in the sample month"],
  ["Sales", "sales", 1, "Net product sales excluding VAT and shipping"],
  ["Net cost of goods sold", "cogs", -1, "Historic goods cost less explicit saleable-return cost reversal"],
  ["Gross profit", "grossProfit", 1, "Sales less net cost of goods sold"],
  ["Net shipping revenue", "shippingRevenue", 1, "Shipping charges less shipping refunds, excluding VAT"],
  ["Outbound shipping", "outboundShipping", -1, "Sample cost per original order"],
  ["Fulfilment", "fulfilment", -1, "Sample cost per original order"],
  ["Payment processing", "processing", -1, "Sample cost per original order"],
  ["Contribution before marketing", "contributionBeforeMarketing", 1, "Gross profit plus net shipping revenue less variable operating costs"],
  ["Marketing expenditure", "marketing", -1, "Period expense deducted once; no assumed sales response"],
  ["Contribution", "contribution", 1, "Contribution after marketing"],
  ["Staff", "staff", -1, "Separate operating overhead category"],
  ["Software", "software", -1, "Separate operating overhead category"],
  ["Other overheads", "otherOverheads", -1, "Excludes staff, software and depreciation/amortisation"],
  ["Depreciation and amortisation", "depreciationAmortisation", -1, "Included in operating profit"],
  ["Operating profit", "operatingProfit", 1, "Contribution less operating overheads; excludes interest and corporation tax"],
  ["Add back depreciation and amortisation", "depreciationAmortisation", 1, "Added back only for EBITDA"],
  ["EBITDA", "ebitda", 1, "Operating profit plus depreciation and amortisation"],
];

export default function ProfitGrowth() {
  const [scenario, setScenario] = useState<ScenarioState>({ ...ZERO_SCENARIO_STATE });
  const model = computeScenario(scenario);
  const isSimulatorAvailable = canAccess("profit_simulator");
  const isBridgeAvailable = canAccess("profit_driver_table");
  return (
    <AppLayout showMonitoring={false}>
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-display font-bold">Profit Overview</h1>
          <p className="text-sm text-muted-foreground mt-2">Explore the same sample month as Scenario Planner, from sales to contribution and operating profit.</p>
        </header>
        <section aria-label="Profit reporting status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <h2 className="font-bold">Actual profit reporting: unavailable</h2>
          <p className="text-sm">No store financial data is connected here. These are sample figures for one synthetic month in GBP, not your store’s results or a forecast. Product and shipping sales exclude VAT.</p>
          <p className="text-sm">Sales means net product sales. Contribution is after marketing. Operating profit includes depreciation and amortisation; EBITDA adds them back. Missing real costs are not treated as zero.</p>
          <p className="text-sm">This page starts from the shared sample baseline. Unsaved Scenario Planner edits are not synchronised here; opening either page starts its own scenario from the baseline.</p>
        </section>
        <section aria-label="Sample profit overview" className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Sample profit overview</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Fixed starting position · one sample month · GBP</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...headlineMetrics, ["EBITDA", "ebitda"] as const].map(([label, key]) => (
              <div key={key} role="group" aria-label={label} className="rounded-lg bg-secondary/40 p-3 min-w-0">
                <h3 className="text-xs font-semibold">{label}</h3>
                <p className="text-xl font-bold tabular-nums mt-2">{money(model.baseline[key])}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">1,000 original orders · £100 AOV after discounts and before later refunds. Refund events and cost assumptions are detailed below.</p>
        </section>
        {isSimulatorAvailable ? (
          <section aria-label="Profit simulator" className="rounded-xl border border-border bg-card p-3 sm:p-5">
            <div className="flex justify-between items-center gap-3 mb-4">
              <h2 className="text-xl font-bold">Sample profit simulator</h2>
              <button type="button" onClick={() => setScenario({ ...ZERO_SCENARIO_STATE })} className="inline-flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm"><RefreshCw className="w-4 h-4" />Reset</button>
            </div>
            <section aria-label="Profit scenario comparison" className="sticky top-0 z-20 rounded-xl border border-primary/30 bg-card shadow-md p-3 mb-5">
              <h3 className="text-sm font-bold">Profit scenario comparison</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Current scenario compared with the sample starting position · one month · GBP</p>
              <div className="grid grid-cols-3 gap-2" aria-live="polite" aria-atomic="true">
                {headlineMetrics.map(([label, key]) => (
                  <div key={key} role="group" aria-label={label} className="min-w-0 rounded-lg bg-secondary/40 p-1.5 sm:p-3">
                    <h4 className="text-xs font-semibold">{label}</h4>
                    <p className="text-xs text-muted-foreground mt-2">Your scenario</p>
                    <p className="text-sm sm:text-2xl font-bold tabular-nums">{money(model.result[key])}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">Sample starting position {money(model.baseline[key])}</p>
                    <p className="text-[11px] sm:text-sm font-semibold tabular-nums mt-2">Change: {changeText(model.result[key], model.baseline[key])}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Sales excludes shipping and VAT. Contribution is after marketing. Sample arithmetic, not predicted outcomes.</p>
            </section>
            <div className="space-y-5">
              {controls.map(([label, key]) => (
                <div key={key}>
                  <div className="flex justify-between gap-3 text-sm mb-3"><span>{label}</span><span className="font-semibold tabular-nums">{scenario[key] > 0 ? "+" : ""}{scenario[key]}%</span></div>
                  <Slider aria-label={label} value={[scenario[key]]} min={SCENARIO_CONTROL_RANGES[key][0]} max={SCENARIO_CONTROL_RANGES[key][1]} step={1} onValueChange={([value]) => setScenario(previous => ({ ...previous, [key]: value }))} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-5">Orders and AOV are independent assumptions. Marketing changes expense only, without predicting sales. Other overheads exclude staff, software and depreciation. No cash or automatic price-demand effect is calculated.</p>
          </section>
        ) : <p className="rounded-xl border border-border p-4 text-sm">Pro previews the sample profit simulator. Upgrading does not connect store data or activate real profit reporting.</p>}
        <a href="/scenario-lab" className="inline-flex font-semibold text-primary underline">Open Scenario Planner</a>
        <p className="text-sm text-muted-foreground">The full planner offers additional supported cost controls. Your changes here are not saved or transferred when you open it.</p>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Detailed sample profit bridge</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Current simulator values for the same sample month. Deductions have negative signs; subtotal rows show the running result. This reconciles sample arithmetic only, not source data.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Sample profit bridge</caption>
              <thead><tr><th scope="col" className="text-left py-2 pr-3">Component</th><th scope="col" className="text-right py-2">Current sample GBP</th></tr></thead>
              <tbody>
                {bridgeRows.map(([label, key, sign, meaning]) => (
                  <tr key={label} className="border-t border-border/40">
                    <th scope="row" className="py-3 pr-3 text-left font-medium"><span>{label}</span><span className="block text-xs font-normal text-muted-foreground mt-1">{meaning}</span></th>
                    <td className="text-right font-semibold tabular-nums whitespace-nowrap">{isBridgeAvailable ? money(model.result[key] * sign) : "Locked"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isBridgeAvailable && <p className="text-xs text-muted-foreground mt-3">Detailed sample amounts are available in the Pro preview.</p>}
        </section>
        <details className="rounded-xl border border-border p-4">
          <summary className="font-semibold cursor-pointer">Sample assumptions and limits</summary>
          <ul className="list-disc pl-5 mt-3 space-y-2 text-sm text-muted-foreground">{model.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul>
        </details>
        <p className="text-sm text-muted-foreground">Store-specific profit drivers, staff trends, opportunity values and recommendations remain unavailable. This sample month does not establish which action your business should take.</p>
      </div>
    </AppLayout>
  );
}
