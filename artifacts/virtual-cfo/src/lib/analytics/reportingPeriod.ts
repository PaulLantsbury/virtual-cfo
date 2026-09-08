export type ReportingTimeline = "last_complete_month" | "last_complete_week";
export type PeriodStatus = "loading" | "ready" | "stale" | "empty" | "error";
export type ReportingPeriod = { dateFrom: string; dateTo: string; label: string };

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Calendar boundaries use the browser timezone until store timezones are wired. */
export function getReportingPeriod(timeline: ReportingTimeline, back = 0, now = new Date()): ReportingPeriod {
  if (timeline === "last_complete_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1 - back, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { dateFrom: isoDate(start), dateTo: isoDate(end), label: start.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) };
  }
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Sunday is still in progress. Only include it once Monday has started.
  end.setDate(end.getDate() - (end.getDay() || 7) - back * 7);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { dateFrom: isoDate(start), dateTo: isoDate(end), label: `Week ending ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` };
}

export type ResolvedPeriod<T> = ReportingPeriod & {
  status: Exclude<PeriodStatus, "loading">;
  metrics: T | null;
  periodsBack: number | null;
};

/** An empty period is not a failed request, and neither is a zero-sales order. */
export async function resolveReportingPeriod<T extends { errors: unknown[] }>(options: {
  timeline: ReportingTimeline;
  now?: Date;
  maxLookback?: number;
  signal?: AbortSignal;
  countOrders: (period: ReportingPeriod) => Promise<number>;
  loadMetrics: (period: ReportingPeriod) => Promise<T>;
}): Promise<ResolvedPeriod<T>> {
  const now = options.now ?? new Date();
  const latest = getReportingPeriod(options.timeline, 0, now);
  const limit = options.maxLookback ?? (options.timeline === "last_complete_month" ? 23 : 103);
  try {
    for (let back = 0; back <= limit; back++) {
      options.signal?.throwIfAborted();
      const period = getReportingPeriod(options.timeline, back, now);
      const count = await options.countOrders(period);
      options.signal?.throwIfAborted();
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid order count");
      if (count === 0) continue;
      const metrics = await options.loadMetrics(period);
      options.signal?.throwIfAborted();
      if (metrics.errors.length) return { ...period, status: "error", metrics: null, periodsBack: back };
      return { ...period, status: back === 0 ? "ready" : "stale", metrics, periodsBack: back };
    }
    return { ...latest, status: "empty", metrics: null, periodsBack: null };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { ...latest, status: "error", metrics: null, periodsBack: null };
  }
}
