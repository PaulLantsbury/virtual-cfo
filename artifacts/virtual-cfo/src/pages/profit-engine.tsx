import { AppLayout } from "@/components/layout/AppLayout";
import { canAccess } from "@/lib/plan";
import {
  computeScenario, ZERO_SCENARIO_STATE,
  type ScenarioMetrics,
} from "@/lib/scenario-model";

const money = (value: number) => `${value < 0 ? "−" : ""}£${Math.abs(value).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
const headlineMetrics = [
  ["Sales", "sales"], ["Contribution", "contribution"], ["Operating profit", "operatingProfit"],
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
  const model = computeScenario(ZERO_SCENARIO_STATE);
  const isBridgeAvailable = canAccess("profit_driver_table");
  return (
    <AppLayout showMonitoring={false}>
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-display font-bold">Profit Overview</h1>
          <p className="text-sm text-muted-foreground mt-2">See where the money goes, from sales through costs to contribution and operating profit.</p>
        </header>
        <section aria-label="Profit reporting status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <h2 className="font-bold">Actual profit reporting: unavailable</h2>
          <p className="text-sm">No store financial data is connected here. These are sample figures for one synthetic month in GBP, not your store’s results or a forecast. Product and shipping sales exclude VAT.</p>
          <p className="text-sm">Sales means net product sales. Contribution is after marketing. Operating profit includes depreciation and amortisation; EBITDA adds them back. Missing real costs are not treated as zero.</p>
          <p className="text-sm">This overview explains the sample starting position. Scenario Planner is the separate place to explore changes.</p>
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
        <a href="/scenario-lab" className="inline-flex font-semibold text-primary underline">Explore changes in Scenario Planner</a>
        <p className="text-sm text-muted-foreground">Use Scenario Planner to test different assumptions. This overview shows the sample starting position and is not changed by those experiments.</p>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Detailed sample profit bridge</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Breakdown of the same sample month shown above. Deductions have negative signs; subtotal rows show the running result. This reconciles sample arithmetic only, not source data.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Sample profit bridge</caption>
              <thead><tr><th scope="col" className="text-left py-2 pr-3">Component</th><th scope="col" className="text-right py-2">Sample month GBP</th></tr></thead>
              <tbody>
                {bridgeRows.map(([label, key, sign, meaning]) => (
                  <tr key={label} className="border-t border-border/40">
                    <th scope="row" className="py-3 pr-3 text-left font-medium"><span>{label}</span><span className="block text-xs font-normal text-muted-foreground mt-1">{meaning}</span></th>
                    <td className="text-right font-semibold tabular-nums whitespace-nowrap">{isBridgeAvailable ? money(model.baseline[key] * sign) : "Locked"}</td>
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
