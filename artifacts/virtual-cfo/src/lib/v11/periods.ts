import type { DateRange } from "./types.ts";
export type PeriodPreset =
  | "yesterday"
  | "last-week"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "last-12-months"
  | "custom";
export type ComparisonPreset =
  | "previous-equivalent"
  | "prior-week"
  | "prior-month"
  | "prior-3-months"
  | "prior-6-months"
  | "prior-12-months"
  | "same-period-last-year"
  | "custom"
  | "none";
export interface ResolvedReportContext {
  period: DateRange | null;
  comparison: DateRange | null;
  notices: string[];
  issues: string[];
  timezone: "Europe/London";
  leapDayPolicy: "Clamp 29 February to 28 February";
  aggregation: "daily" | "monthly" | null;
}
const DAY = 86400000;
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) =>
  iso(new Date(date(s).getTime() + n * DAY));
const monthStart = (s: string) => s.slice(0, 8) + "01";
function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(date(s).getTime()) &&
    iso(date(s)) === s
  );
}
export function validRange(
  range: DateRange | undefined | null,
): range is DateRange {
  return (
    !!range &&
    validDate(range.from) &&
    validDate(range.to) &&
    range.from <= range.to
  );
}
export function inclusiveDays(range: DateRange): number {
  return (date(range.to).getTime() - date(range.from).getTime()) / DAY + 1;
}
function shiftMonths(s: string, count: number) {
  const d = date(s),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + count);
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return iso(d);
}
function localDay(now: Date | string) {
  const instant = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(instant.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
export const PERIOD_OPTIONS: readonly { value: PeriodPreset; label: string }[] =
  [
    { value: "yesterday", label: "Yesterday" },
    { value: "last-week", label: "Last week" },
    { value: "last-month", label: "Last month" },
    { value: "last-3-months", label: "Last 3 months" },
    { value: "last-6-months", label: "Last 6 months" },
    { value: "last-12-months", label: "Last 12 months" },
    { value: "custom", label: "Custom" },
  ];
export const COMPARISON_OPTIONS: readonly {
  value: ComparisonPreset;
  label: string;
}[] = [
  { value: "previous-equivalent", label: "Previous equivalent period" },
  { value: "prior-week", label: "Prior week" },
  { value: "prior-month", label: "Prior month" },
  { value: "prior-3-months", label: "Prior 3 months" },
  { value: "prior-6-months", label: "Prior 6 months" },
  { value: "prior-12-months", label: "Prior 12 months" },
  { value: "same-period-last-year", label: "Same period last year" },
  { value: "custom", label: "Custom" },
  { value: "none", label: "None" },
];
/** Resolves completed business-local dates only. Never moves the fictional Q3 snapshot. */
export function resolveReportContext(
  now: Date | string,
  preset: PeriodPreset = "last-3-months",
  comparisonPreset: ComparisonPreset = "previous-equivalent",
  custom: { period?: DateRange; comparison?: DateRange } = {},
): ResolvedReportContext {
  const notices: string[] = [],
    issues: string[] = [];
  let period: DateRange | null = null,
    comparison: DateRange | null = null;
  const base = {
    timezone: "Europe/London" as const,
    leapDayPolicy: "Clamp 29 February to 28 February" as const,
  };
  const today = localDay(now);
  if (!today)
    return {
      ...base,
      period: null,
      comparison: null,
      notices,
      issues: ["A valid reference time is required."],
      aggregation: null,
    };
  let calendarMonths: number | null = null;
  if (preset === "custom") {
    if (validRange(custom.period)) period = { ...custom.period };
    else issues.push("Enter a valid inclusive custom period.");
  } else if (preset === "yesterday")
    period = { from: addDays(today, -1), to: addDays(today, -1) };
  else if (preset === "last-week") {
    const weekday = (date(today).getUTCDay() + 6) % 7;
    const monday = addDays(today, -weekday);
    period = { from: addDays(monday, -7), to: addDays(monday, -1) };
  } else {
    const months: Partial<Record<PeriodPreset, number>> = {
      "last-month": 1,
      "last-3-months": 3,
      "last-6-months": 6,
      "last-12-months": 12,
    };
    calendarMonths = months[preset] ?? null;
    if (calendarMonths) {
      const start = monthStart(today);
      period = {
        from: shiftMonths(start, -calendarMonths),
        to: addDays(start, -1),
      };
    } else issues.push("Choose a supported period.");
  }
  if (period && period.to >= today) {
    issues.push(
      "Historical periods must end before the current business-local day.",
    );
    period = null;
  }
  if (period) {
    if (comparisonPreset === "none") comparison = null;
    else if (comparisonPreset === "custom") {
      if (validRange(custom.comparison)) comparison = { ...custom.comparison };
      else issues.push("Enter a valid inclusive custom comparison.");
    } else if (comparisonPreset === "same-period-last-year") {
      comparison = {
        from: shiftMonths(period.from, -12),
        to: shiftMonths(period.to, -12),
      };
      if (period.from.endsWith("-02-29") || period.to.endsWith("-02-29"))
        notices.push("Leap day is clamped to 28 February in the prior year.");
    } else if (comparisonPreset === "previous-equivalent") {
      comparison = {
        from: calendarMonths
          ? shiftMonths(period.from, -calendarMonths)
          : addDays(period.from, -inclusiveDays(period)),
        to: addDays(period.from, -1),
      };
    } else if (comparisonPreset === "prior-week")
      comparison = {
        from: addDays(period.from, -7),
        to: addDays(period.from, -1),
      };
    else {
      const priorMonths: Partial<Record<ComparisonPreset, number>> = {
        "prior-month": 1,
        "prior-3-months": 3,
        "prior-6-months": 6,
        "prior-12-months": 12,
      };
      const months = priorMonths[comparisonPreset];
      if (months)
        comparison = {
          from: shiftMonths(period.from, -months),
          to: addDays(period.from, -1),
        };
      else issues.push("Choose a supported comparison.");
    }
    if (
      comparison &&
      comparison.from <= period.to &&
      comparison.to >= period.from
    ) {
      issues.push("Comparison must not overlap the selected period.");
      comparison = null;
    }
    if (comparison && inclusiveDays(period) !== inclusiveDays(comparison))
      notices.push(
        "Unequal date ranges: prioritise margins and per-order comparisons.",
      );
  }
  return {
    ...base,
    period,
    comparison,
    notices,
    issues,
    aggregation: period
      ? inclusiveDays(period) > 62
        ? "monthly"
        : "daily"
      : null,
  };
}
