/** Disconnected normalized read contract, not a Google/Meta API payload or collector. */
export type AdsProvider = "google_ads" | "meta_ads";
export type CampaignPurpose = {
  value: "acquisition" | "retention" | "brand" | "mixed" | "unknown";
  basis: "operator_classified" | "source_explicit" | "unknown";
};
export type AttributionObservation = {
  definitionKey: string;
  purchaseCount: string | null; // Fractional provider attribution is not an integer order count.
  purchaseValueMinor: number | null;
  valueBasis: "provider_reported_unreconciled";
  dateBasis: "interaction_date" | "conversion_date" | "mixed" | "unknown";
  model: string; // Explicit 'unknown' when not observed. Never infer causal incrementality.
  window: {
    state: "reported" | "unknown";
    clickDays: number | null;
    viewDays: number | null;
    engagedViewDays: number | null;
  };
};
export type MarketingDayFact = {
  contractVersion: "marketing_provider_fact_v1";
  namespace: AdsProvider;
  storeId: string;
  accountId: string;
  grain: "account_day" | "campaign_day";
  campaignId: string | null;
  campaignPurpose?: CampaignPurpose;
  day: string; // Provider account-local day; never silently recut to the store's timezone.
  accountTimezone: string;
  currency: string;
  minorUnitExponent: number;
  spend: {
    amountMinor: number | null;
    taxBasis: "exclusive" | "inclusive" | "unknown";
  };
  performance: {
    impressions: number | null;
    clicks: number | null;
    attribution: AttributionObservation[];
  };
  coverage: {
    state: "complete" | "partial" | "unknown";
    reason:
      | "all_pages_read"
      | "pagination_incomplete"
      | "not_assessed"
      | "provider_error";
  };
  observation: {
    retrievedAt: string;
    dataAsOfAt: string;
    expectedReportingLagHours: number | null;
    settledThroughDay: string | null;
    attributionMaturity: "provisional" | "mature" | "unknown";
  };
};
export type AdsAccount = { namespace: AdsProvider; accountId: string };
export type MarketingExpenseRequest = {
  storeId: string;
  from: string;
  to: string;
  currency: string;
  minorUnitExponent: number;
  timezone: string;
  expectedAccounts: AdsAccount[];
  platformFacts: unknown[];
  xeroExpense: null | {
    amountMinor: number;
    currency: string;
    minorUnitExponent: number;
    from: string;
    to: string;
    timezone: string;
    storeId: string;
    coverage: "complete" | "partial" | "unknown";
    basis: "advertising_media_only_ex_tax";
    retrievedAt: string;
  };
  selectedSource: "platform_spend" | "xero_advertising_expense";
  varianceReviewed: boolean;
  maxObservationAgeHours: number; // Explicit consumer policy; no universal freshness threshold.
};

const unavailable = (): never => {
  throw Error("Marketing evidence contract unavailable");
};
const object = (v: unknown): Record<string, unknown> => {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.getPrototypeOf(v) !== Object.prototype
  )
    unavailable();
  return v as Record<string, unknown>;
};
const shape = (
  v: unknown,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> => {
  const r = object(v);
  if (
    required.some((k) => !Object.hasOwn(r, k)) ||
    Object.keys(r).some((k) => !required.includes(k) && !optional.includes(k))
  )
    unavailable();
  return r;
};
const text = (v: unknown, max = 128): v is string =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length <= max &&
  !/[\x00-\x20\x7f]/.test(v);
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const instant = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const money = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0;
const unit = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3;
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const currency = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Z]{3}$/.test(v);
const provider = (v: unknown): v is AdsProvider =>
  v === "google_ads" || v === "meta_ads";
const zone = (v: unknown): v is string => {
  if (!text(v) || /^[+-]/.test(v)) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: v });
    return true;
  } catch {
    return false;
  }
};
const localDay = (value: Date, timezone: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(value)
      .map((p) => [p.type, p.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
};
const oneOf = (v: unknown, values: readonly unknown[]) => values.includes(v);
const freeze = <T>(v: T): T => {
  if (v && typeof v === "object") {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
};

/** Strict allowlist; no payloads, credentials, contact data or source-error text. */
export function validateMarketingDayFact(
  input: unknown,
  now: Date = new Date(),
): MarketingDayFact {
  try {
    if (!(now instanceof Date) || !Number.isFinite(now.valueOf()))
      unavailable();
    const r = shape(
      input,
      [
        "contractVersion",
        "namespace",
        "storeId",
        "accountId",
        "grain",
        "campaignId",
        "day",
        "accountTimezone",
        "currency",
        "minorUnitExponent",
        "spend",
        "performance",
        "coverage",
        "observation",
      ],
      ["campaignPurpose"],
    );
    if (
      r.contractVersion !== "marketing_provider_fact_v1" ||
      !provider(r.namespace) ||
      !uuid(r.storeId) ||
      !text(r.accountId) ||
      !oneOf(r.grain, ["account_day", "campaign_day"]) ||
      (r.grain === "account_day"
        ? r.campaignId !== null
        : !text(r.campaignId)) ||
      !date(r.day) ||
      !zone(r.accountTimezone) ||
      !currency(r.currency) ||
      !unit(r.minorUnitExponent)
    )
      unavailable();
    const s = shape(r.spend, ["amountMinor", "taxBasis"]);
    if (
      (s.amountMinor !== null && !money(s.amountMinor)) ||
      !oneOf(s.taxBasis, ["exclusive", "inclusive", "unknown"])
    )
      unavailable();
    const p = shape(r.performance, ["impressions", "clicks", "attribution"]);
    if (
      [p.impressions, p.clicks].some((v) => v !== null && !money(v)) ||
      !Array.isArray(p.attribution) ||
      p.attribution.length > 20
    )
      unavailable();
    const keys = new Set<string>();
    for (const value of p.attribution as unknown[]) {
      const a = shape(value, [
        "definitionKey",
        "purchaseCount",
        "purchaseValueMinor",
        "valueBasis",
        "dateBasis",
        "model",
        "window",
      ]);
      if (
        !text(a.definitionKey) ||
        keys.has(a.definitionKey) ||
        (a.purchaseCount !== null &&
          (typeof a.purchaseCount !== "string" ||
            !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(a.purchaseCount))) ||
        (a.purchaseValueMinor !== null &&
          !Number.isSafeInteger(a.purchaseValueMinor)) ||
        a.valueBasis !== "provider_reported_unreconciled" ||
        !oneOf(a.dateBasis, [
          "interaction_date",
          "conversion_date",
          "mixed",
          "unknown",
        ]) ||
        !text(a.model)
      )
        unavailable();
      keys.add(a.definitionKey as string);
      const w = shape(a.window, [
        "state",
        "clickDays",
        "viewDays",
        "engagedViewDays",
      ]);
      if (
        !oneOf(w.state, ["reported", "unknown"]) ||
        [w.clickDays, w.viewDays, w.engagedViewDays].some(
          (v) =>
            v !== null &&
            (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 366),
        ) ||
        (w.state === "unknown"
          ? [w.clickDays, w.viewDays, w.engagedViewDays].some((v) => v !== null)
          : [w.clickDays, w.viewDays, w.engagedViewDays].every(
              (v) => v === null,
            ))
      )
        unavailable();
    }
    const c = shape(r.coverage, ["state", "reason"]);
    if (
      !oneOf(c.state, ["complete", "partial", "unknown"]) ||
      !oneOf(c.reason, [
        "all_pages_read",
        "pagination_incomplete",
        "not_assessed",
        "provider_error",
      ]) ||
      (c.state === "complete") !== (c.reason === "all_pages_read")
    )
      unavailable();
    if (
      (r.day as string) > localDay(now, r.accountTimezone as string) ||
      (c.state === "complete" &&
        (r.day as string) >= localDay(now, r.accountTimezone as string))
    )
      unavailable();
    const o = shape(r.observation, [
      "retrievedAt",
      "dataAsOfAt",
      "expectedReportingLagHours",
      "settledThroughDay",
      "attributionMaturity",
    ]);
    if (
      !instant(o.retrievedAt) ||
      !instant(o.dataAsOfAt) ||
      o.dataAsOfAt > o.retrievedAt ||
      (c.state === "complete" &&
        localDay(new Date(o.dataAsOfAt), r.accountTimezone as string) <=
          (r.day as string)) ||
      Date.parse(o.retrievedAt) > now.valueOf() ||
      (o.expectedReportingLagHours !== null &&
        (!Number.isSafeInteger(o.expectedReportingLagHours) ||
          (o.expectedReportingLagHours as number) < 0)) ||
      (o.settledThroughDay !== null &&
        (!date(o.settledThroughDay) ||
          o.settledThroughDay > localDay(now, r.accountTimezone as string))) ||
      !oneOf(o.attributionMaturity, ["provisional", "mature", "unknown"]) ||
      (o.attributionMaturity === "mature" &&
        (o.settledThroughDay === null ||
          (o.settledThroughDay as string) < (r.day as string)))
    )
      unavailable();
    if (r.campaignPurpose !== undefined) {
      const q = shape(r.campaignPurpose, ["value", "basis"]);
      if (
        !oneOf(q.value, [
          "acquisition",
          "retention",
          "brand",
          "mixed",
          "unknown",
        ]) ||
        !oneOf(q.basis, [
          "operator_classified",
          "source_explicit",
          "unknown",
        ]) ||
        (q.value === "unknown") !== (q.basis === "unknown")
      )
        unavailable();
    }
    return freeze(structuredClone(input)) as MarketingDayFact;
  } catch {
    return unavailable();
  }
}

/** Snapshot age is separate from attribution maturity; policy supplies its own age limit. */
export function assessObservation(
  fact: unknown,
  {
    now,
    maxObservationAgeHours,
  }: { now: Date; maxObservationAgeHours: number },
) {
  const r = validateMarketingDayFact(fact, now);
  if (
    !Number.isSafeInteger(maxObservationAgeHours) ||
    maxObservationAgeHours < 0
  )
    unavailable();
  return Object.freeze({
    snapshotFresh:
      now.valueOf() - Date.parse(r.observation.retrievedAt) <=
      maxObservationAgeHours * 3600000,
    coverage: r.coverage.state,
    attributionMaturity: r.observation.attributionMaturity,
    expectedReportingLagHours: r.observation.expectedReportingLagHours,
    financialRevenue: false,
  });
}

/** Only selects advertising-media expense evidence; never computes profit or sums revenues. */
export function reconcileMarketingExpense(
  input: MarketingExpenseRequest,
  now: Date = new Date(),
) {
  try {
    const r = shape(input, [
      "storeId",
      "from",
      "to",
      "currency",
      "minorUnitExponent",
      "timezone",
      "expectedAccounts",
      "platformFacts",
      "xeroExpense",
      "selectedSource",
      "varianceReviewed",
      "maxObservationAgeHours",
    ]);
    if (
      !uuid(r.storeId) ||
      !date(r.from) ||
      !date(r.to) ||
      r.from > r.to ||
      Date.parse(r.to) - Date.parse(r.from) > 365 * 86400000 ||
      !currency(r.currency) ||
      !unit(r.minorUnitExponent) ||
      !zone(r.timezone) ||
      !Array.isArray(r.platformFacts) ||
      r.platformFacts.length > 20000 ||
      !Array.isArray(r.expectedAccounts) ||
      r.expectedAccounts.length > 50 ||
      typeof r.varianceReviewed !== "boolean" ||
      !Number.isSafeInteger(r.maxObservationAgeHours) ||
      (r.maxObservationAgeHours as number) < 0 ||
      !oneOf(r.selectedSource, ["platform_spend", "xero_advertising_expense"])
    )
      unavailable();
    const from = r.from as string,
      to = r.to as string,
      maxAge = r.maxObservationAgeHours as number;
    if (to >= localDay(now, r.timezone as string)) unavailable();
    const expected = new Set<string>();
    for (const value of r.expectedAccounts as unknown[]) {
      const a = shape(value, ["namespace", "accountId"]);
      if (
        !provider(a.namespace) ||
        !text(a.accountId) ||
        expected.has(JSON.stringify([a.namespace, a.accountId]))
      )
        unavailable();
      expected.add(JSON.stringify([a.namespace, a.accountId]));
    }
    const facts = (r.platformFacts as unknown[]).map((v) =>
      validateMarketingDayFact(v, now),
    );
    const seen = new Set<string>();
    let total = 0,
      platformComplete = expected.size > 0;
    for (const f of facts) {
      const account = JSON.stringify([f.namespace, f.accountId]),
        key = JSON.stringify([account, f.day]);
      if (
        f.storeId !== r.storeId ||
        !expected.has(account) ||
        f.grain !== "account_day" ||
        f.currency !== r.currency ||
        f.minorUnitExponent !== r.minorUnitExponent ||
        f.accountTimezone !== r.timezone ||
        f.day < from ||
        f.day > to ||
        seen.has(key)
      )
        unavailable();
      seen.add(key);
      if (
        f.coverage.state !== "complete" ||
        f.spend.amountMinor === null ||
        f.spend.taxBasis !== "exclusive" ||
        !assessObservation(f, { now, maxObservationAgeHours: maxAge })
          .snapshotFresh
      )
        platformComplete = false;
      total += f.spend.amountMinor ?? 0;
      if (!Number.isSafeInteger(total)) unavailable();
    }
    const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
    platformComplete = platformComplete && seen.size === expected.size * days;
    let xero: number | null = null;
    if (r.xeroExpense !== null) {
      const x = shape(r.xeroExpense, [
        "amountMinor",
        "currency",
        "minorUnitExponent",
        "from",
        "to",
        "timezone",
        "storeId",
        "coverage",
        "basis",
        "retrievedAt",
      ]);
      if (
        !money(x.amountMinor) ||
        x.currency !== r.currency ||
        x.minorUnitExponent !== r.minorUnitExponent ||
        x.from !== r.from ||
        x.to !== r.to ||
        x.timezone !== r.timezone ||
        x.storeId !== r.storeId ||
        !oneOf(x.coverage, ["complete", "partial", "unknown"]) ||
        x.basis !== "advertising_media_only_ex_tax" ||
        !instant(x.retrievedAt) ||
        Date.parse(x.retrievedAt) > now.valueOf() ||
        (x.coverage === "complete" &&
          localDay(new Date(x.retrievedAt as string), r.timezone as string) <=
            to)
      )
        unavailable();
      if (
        x.coverage === "complete" &&
        now.valueOf() - Date.parse(x.retrievedAt as string) <= maxAge * 3600000
      )
        xero = x.amountMinor as number;
    }
    const platform = platformComplete ? total : null,
      variance = platform === null || xero === null ? null : platform - xero;
    const selected = r.selectedSource === "platform_spend" ? platform : xero;
    const needsReview =
      variance !== null && variance !== 0 && !r.varianceReviewed;
    return freeze({
      state:
        selected === null
          ? "unavailable"
          : needsReview
            ? "review_required"
            : "supported",
      expenseKey: "advertising_media",
      deduction:
        selected === null || needsReview
          ? null
          : {
              source: r.selectedSource,
              amountMinor: selected,
              currency: r.currency,
              minorUnitExponent: r.minorUnitExponent,
            },
      platformSpendMinor: platform,
      xeroExpenseMinor: xero,
      varianceMinor: variance,
      reconciliation:
        variance === null
          ? "not_compared"
          : variance === 0
            ? "equal"
            : needsReview
              ? "difference_requires_review"
              : "difference_reviewed",
      attributedPurchaseValueUsed: false,
      financialRevenueAdded: false,
      otherMarketingCostsIncluded: false,
    });
  } catch {
    return unavailable();
  }
}
