import { buildBriefing } from "@/lib/analytics/briefing";
import type { TradingMetricsResponse } from "@/lib/analytics/tradingMetrics";
import type { LatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import { DataPeriodLabel } from "./DataPeriodLabel";

/** No diagnoses, changes or recovery estimates are supported by stale/absent data. */
export function BriefingDataState({ period }: { period: LatestDataPeriod<TradingMetricsResponse> }) {
  const copy = {
    loading: ["Checking your trading data", "Finding the most recent completed period with orders."],
    empty: ["No trading data found", "No orders were found in the reporting periods checked over the past two years. This does not establish that sales have fallen. Check your data connection or import more recent trading history."],
    error: ["Trading data is unavailable", "We could not verify the data needed for this briefing. Check your connection and try again. Missing results have not been treated as zero sales."],
    stale: ["Your trading data needs updating", `The most recent period with orders is ${period.periodLabel}. These are historical figures. A current briefing, performance changes and recommended actions need more recent data.`],
    ready: ["Trading data available", "Your completed reporting period is ready."],
  }[period.status];
  const data = period.status === "stale" ? period.phase1?.data : null;
  const historical = data ? buildBriefing(data, null, "empty").metrics.map(metric => [metric.title, metric.value]) : [];
  return (
    <section className="space-y-6" aria-live="polite">
      <div className="rounded-2xl border border-amber-200 bg-card p-6">
        <h2 className="text-xl font-bold">{copy[0]}</h2>
        <p className="mt-3 text-muted-foreground max-w-3xl">{copy[1]}</p>
        {data && <DataPeriodLabel periodLabel={period.periodLabel} loading={false} status="stale" dateFrom={period.dateFrom} dateTo={period.dateTo} />}
      </div>
      {data && <div>
        <h3 className="font-semibold mb-3">Historical trading figures</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {historical.map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p>
          </div>)}
        </div>
      </div>}
    </section>
  );
}
