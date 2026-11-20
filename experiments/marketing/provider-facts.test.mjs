import test from "node:test";
import assert from "node:assert/strict";
import {
  validateMarketingDayFact,
  assessObservation,
  reconcileMarketingExpense,
} from "./provider-facts.ts";

const now = new Date("2026-10-15T12:00:00.000Z");
const storeId = "10000000-0000-4000-8000-000000000001";
const fresh = "2026-10-15T11:00:00.000Z";
const fact = (namespace = "google_ads", day = "2026-10-14") => ({
  contractVersion: "marketing_provider_fact_v1",
  namespace,
  storeId,
  accountId: "synthetic-account",
  grain: "account_day",
  campaignId: null,
  day,
  accountTimezone: "Europe/London",
  currency: "GBP",
  minorUnitExponent: 2,
  spend: { amountMinor: 10000, taxBasis: "exclusive" },
  performance: {
    impressions: 1000,
    clicks: 25,
    attribution: [
      {
        definitionKey: "synthetic-purchase-window",
        purchaseCount: "1.25",
        purchaseValueMinor: 50000,
        valueBasis: "provider_reported_unreconciled",
        dateBasis: "interaction_date",
        model: "provider_reported_example",
        window: {
          state: "reported",
          clickDays: 7,
          viewDays: 1,
          engagedViewDays: null,
        },
      },
    ],
  },
  coverage: { state: "complete", reason: "all_pages_read" },
  observation: {
    retrievedAt: fresh,
    dataAsOfAt: fresh,
    expectedReportingLagHours: null,
    settledThroughDay: null,
    attributionMaturity: "provisional",
  },
});
const request = (facts = [fact()], extra = {}) => ({
  storeId,
  from: "2026-10-14",
  to: "2026-10-14",
  currency: "GBP",
  minorUnitExponent: 2,
  timezone: "Europe/London",
  expectedAccounts: facts
    .map((f) => ({ namespace: f.namespace, accountId: f.accountId }))
    .filter(
      (v, i, a) =>
        a.findIndex(
          (q) => q.namespace === v.namespace && q.accountId === v.accountId,
        ) === i,
    ),
  platformFacts: facts,
  xeroExpense: null,
  selectedSource: "platform_spend",
  varianceReviewed: false,
  maxObservationAgeHours: 24,
  ...extra,
});
const xero = (amountMinor = 10000) => ({
  amountMinor,
  storeId,
  from: "2026-10-14",
  to: "2026-10-14",
  timezone: "Europe/London",
  currency: "GBP",
  minorUnitExponent: 2,
  coverage: "complete",
  basis: "advertising_media_only_ex_tax",
  retrievedAt: fresh,
});

test("both provider namespaces preserve purchase definitions, fractional attribution and unknown purpose", () => {
  for (const namespace of ["google_ads", "meta_ads"]) {
    const input = fact(namespace),
      r = validateMarketingDayFact(input, now);
    assert.equal(r.namespace, namespace);
    assert.equal(r.performance.attribution[0].purchaseCount, "1.25");
    assert.equal(r.campaignPurpose, undefined);
    assert.equal(
      r.performance.attribution[0].valueBasis,
      "provider_reported_unreconciled",
    );
    assert.ok(Object.isFrozen(r.performance.attribution[0]));
    assert.notEqual(r, input);
  }
});
test("window/model/date basis unknown stays explicit, without default attribution assumptions", () => {
  const input = fact("meta_ads");
  Object.assign(input.performance.attribution[0], {
    dateBasis: "unknown",
    model: "unknown",
    window: {
      state: "unknown",
      clickDays: null,
      viewDays: null,
      engagedViewDays: null,
    },
  });
  const r = validateMarketingDayFact(input, now);
  assert.equal(r.performance.attribution[0].window.clickDays, null);
  assert.equal(r.performance.attribution[0].dateBasis, "unknown");
  input.performance.attribution[0].window.clickDays = 7;
  assert.throws(
    () => validateMarketingDayFact(input, now),
    /contract unavailable/,
  );
});
test("source attribution is never added into revenue or expense selection across providers", () => {
  const facts = [fact(), fact("meta_ads")],
    r = reconcileMarketingExpense(request(facts), now);
  assert.equal(r.state, "supported");
  assert.equal(r.deduction.amountMinor, 20000);
  assert.equal(r.financialRevenueAdded, false);
  assert.equal(r.attributedPurchaseValueUsed, false);
  assert.equal(r.otherMarketingCostsIncluded, false);
  facts[0].performance.attribution[0].purchaseValueMinor = 9000000000;
  assert.equal(
    reconcileMarketingExpense(request(facts), now).deduction.amountMinor,
    20000,
  );
});
test("matching Xero/platform evidence selects a single deduction instead of summing both", () => {
  for (const selectedSource of ["platform_spend", "xero_advertising_expense"]) {
    const r = reconcileMarketingExpense(
      request([fact()], { xeroExpense: xero(), selectedSource }),
      now,
    );
    assert.equal(r.deduction.amountMinor, 10000);
    assert.equal(r.reconciliation, "equal");
    assert.equal(r.varianceMinor, 0);
    assert.equal(r.expenseKey, "advertising_media");
  }
});
test("unreviewed timing/amount difference withholds deduction; reviewed choice preserves variance", () => {
  const input = request([fact()], { xeroExpense: xero(12000) });
  const held = reconcileMarketingExpense(input, now);
  assert.equal(held.state, "review_required");
  assert.equal(held.deduction, null);
  assert.equal(held.varianceMinor, -2000);
  const chosen = reconcileMarketingExpense(
    {
      ...input,
      varianceReviewed: true,
      selectedSource: "xero_advertising_expense",
    },
    now,
  );
  assert.equal(chosen.deduction.amountMinor, 12000);
  assert.equal(chosen.reconciliation, "difference_reviewed");
});
test("missing day/account, pagination, unknown spend and tax basis cannot become complete zero", () => {
  const missing = request([fact()], { from: "2026-10-13" });
  assert.equal(reconcileMarketingExpense(missing, now).state, "unavailable");
  const accountMissing = request([fact()], {
    expectedAccounts: [
      { namespace: "google_ads", accountId: "synthetic-account" },
      { namespace: "meta_ads", accountId: "missing-account" },
    ],
  });
  assert.equal(reconcileMarketingExpense(accountMissing, now).deduction, null);
  for (const change of [
    (f) => {
      f.coverage = { state: "partial", reason: "pagination_incomplete" };
    },
    (f) => {
      f.spend.amountMinor = null;
    },
    (f) => {
      f.spend.taxBasis = "unknown";
    },
    (f) => {
      f.spend.taxBasis = "inclusive";
    },
  ]) {
    const f = fact();
    change(f);
    assert.equal(reconcileMarketingExpense(request([f]), now).deduction, null);
  }
  const zero = fact();
  zero.spend.amountMinor = 0;
  const r = reconcileMarketingExpense(request([zero]), now);
  assert.equal(r.state, "supported");
  assert.equal(r.deduction.amountMinor, 0);
});
test("explicit snapshot age never implies mature attribution or universal freshness policy", () => {
  const f = fact();
  const a = assessObservation(f, { now, maxObservationAgeHours: 2 });
  assert.equal(a.snapshotFresh, true);
  assert.equal(a.attributionMaturity, "provisional");
  assert.equal(
    assessObservation(f, { now, maxObservationAgeHours: 0 }).snapshotFresh,
    false,
  );
  assert.equal(
    reconcileMarketingExpense(request([f], { maxObservationAgeHours: 0 }), now)
      .deduction,
    null,
  );
  assert.throws(
    () => assessObservation(f, { now, maxObservationAgeHours: -1 }),
    /contract unavailable/,
  );
  const stale = xero();
  stale.retrievedAt = "2026-10-15T00:00:00.000Z";
  assert.equal(
    reconcileMarketingExpense(
      request([], {
        xeroExpense: stale,
        selectedSource: "xero_advertising_expense",
        maxObservationAgeHours: 1,
      }),
      now,
    ).deduction,
    null,
  );
});
test("mixed currencies/timezones/grains, duplicate rows and unexpected accounts are refused", () => {
  for (const mutate of [
    (f) => {
      f.currency = "USD";
    },
    (f) => {
      f.accountTimezone = "America/New_York";
    },
    (f) => {
      f.grain = "campaign_day";
      f.campaignId = "campaign-1";
    },
    (f) => {
      f.storeId = "20000000-0000-4000-8000-000000000001";
    },
    (f) => {
      f.minorUnitExponent = 0;
    },
  ]) {
    const f = fact();
    mutate(f);
    assert.throws(
      () =>
        reconcileMarketingExpense(
          request([f], {
            currency: "GBP",
            timezone: "Europe/London",
            minorUnitExponent: 2,
          }),
          now,
        ),
      /contract unavailable/,
    );
  }
  assert.throws(
    () => reconcileMarketingExpense(request([fact(), fact()]), now),
    /contract unavailable/,
  );
  assert.throws(
    () =>
      reconcileMarketingExpense(
        request([fact()], { expectedAccounts: [] }),
        now,
      ),
    /contract unavailable/,
  );
});
test("classification is optional, with explicit provenance; no acquisition inference from campaign names", () => {
  const f = fact();
  f.grain = "campaign_day";
  f.campaignId = "brand-acquisition-retargeting";
  assert.equal(validateMarketingDayFact(f, now).campaignPurpose, undefined);
  f.campaignPurpose = { value: "unknown", basis: "unknown" };
  assert.equal(
    validateMarketingDayFact(f, now).campaignPurpose.value,
    "unknown",
  );
  f.campaignPurpose = { value: "acquisition", basis: "unknown" };
  assert.throws(() => validateMarketingDayFact(f, now), /contract unavailable/);
});
test("strict typed boundary refuses invalid values and private payloads without error disclosure", () => {
  for (const mutate of [
    (f) => {
      f.accessToken = "PRIVATE";
    },
    (f) => {
      f.performance.rawResponse = "PRIVATE";
    },
    (f) => {
      f.day = "2026-02-30";
    },
    (f) => {
      f.accountTimezone = "+01:00";
    },
    (f) => {
      f.spend.amountMinor = Number.MAX_SAFE_INTEGER + 1;
    },
    (f) => {
      f.spend.amountMinor = -1;
    },
    (f) => {
      f.observation.retrievedAt = "2026-10-16T11:00:00.000Z";
    },
    (f) => {
      f.performance.attribution[0].purchaseCount = "1e3";
    },
    (f) => {
      f.performance.attribution[0].purchaseCount = "-1";
    },
    (f) => {
      f.performance.attribution[0].window.clickDays = 10000;
    },
    (f) => {
      f.coverage.reason = "not_assessed";
    },
    (f) => {
      f.observation.attributionMaturity = "mature";
    },
  ]) {
    const f = fact();
    mutate(f);
    assert.throws(
      () => validateMarketingDayFact(f, now),
      (error) =>
        error.message === "Marketing evidence contract unavailable" &&
        !error.message.includes("PRIVATE"),
    );
  }
});
test("account timezone controls day completion and future observations are never actual spend", () => {
  const f = fact("meta_ads", "2026-10-15");
  assert.throws(() => validateMarketingDayFact(f, now), /contract unavailable/);
  f.coverage = { state: "partial", reason: "pagination_incomplete" };
  assert.equal(validateMarketingDayFact(f, now).day, "2026-10-15");
  f.day = "2026-10-16";
  assert.throws(() => validateMarketingDayFact(f, now), /contract unavailable/);
  const ended = fact();
  ended.observation.settledThroughDay = "2026-10-15";
  ended.observation.attributionMaturity = "mature";
  assert.equal(
    validateMarketingDayFact(ended, now).observation.attributionMaturity,
    "mature",
  );
});

test("complete provider data must observe the whole account-local day; Xero period timezone must match", () => {
  const f = fact();
  f.observation.dataAsOfAt = "2026-10-14T22:59:59.999Z";
  assert.throws(() => validateMarketingDayFact(f, now), /contract unavailable/);
  f.observation.dataAsOfAt = "2026-10-14T23:00:00.000Z";
  assert.equal(validateMarketingDayFact(f, now).coverage.state, "complete");
  const wrong = xero();
  wrong.timezone = "UTC";
  assert.throws(
    () =>
      reconcileMarketingExpense(request([fact()], { xeroExpense: wrong }), now),
    /contract unavailable/,
  );
});

test("future periods and Xero extracts preceding period close cannot certify complete expense", () => {
  const early = xero();
  early.retrievedAt = "2026-10-14T22:59:59.999Z";
  assert.throws(
    () =>
      reconcileMarketingExpense(
        request([], {
          xeroExpense: early,
          selectedSource: "xero_advertising_expense",
        }),
        now,
      ),
    /contract unavailable/,
  );
  const future = xero();
  future.from = "2026-10-16";
  future.to = "2026-10-16";
  assert.throws(
    () =>
      reconcileMarketingExpense(
        request([], {
          from: future.from,
          to: future.to,
          xeroExpense: future,
          selectedSource: "xero_advertising_expense",
        }),
        now,
      ),
    /contract unavailable/,
  );
});
