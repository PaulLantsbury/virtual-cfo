/** Offline, fail-closed eligibility plan for future Cash/Acquisition summaries. */
const EXPECTED = Object.freeze({ from: '2024-11', through: '2026-10', months: 24, kinds: ['cash', 'acquisition'] });
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const validMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const nextMonth = value => {
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
};
const monthEnd = value => new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).toISOString().slice(0, 10);

function expectedHistory() {
  const out = [];
  for (let cursor = EXPECTED.from; cursor <= EXPECTED.through; cursor = nextMonth(cursor)) out.push(cursor);
  return out;
}

/**
 * `existingRows` is a sanitized inventory of keys only, never source payloads.
 * A month becomes eligible only from supplied verified scheduled receipts plus
 * an exact supported monthly financial version. This planner never compiles,
 * writes, updates, invalidates, or publishes records. Supplied month entries
 * require complete typed proof headers; omit missing evidence rather than
 * inserting placeholder version IDs. Later eligibility cannot cross a gap.
 */
export function prepareSummaryRefreshProposal({
  observedThroughLondon,
  existingRows,
  verifiedMonths = [],
} = {}) {
  assert(validMonth(observedThroughLondon?.slice(0, 7)) && /^\d{4}-\d{2}-\d{2}$/.test(observedThroughLondon)
    && new Date(`${observedThroughLondon}T12:00:00Z`).toISOString().slice(0, 10) === observedThroughLondon, 'Explicit observed London date required');
  const expected = expectedHistory();
  assert(Array.isArray(existingRows) && existingRows.length === EXPECTED.months * EXPECTED.kinds.length, 'Exact existing 48-row inventory required');
  const actual = new Set();
  for (const row of existingRows) {
    assert(row && EXPECTED.kinds.includes(row.kind) && validMonth(row.month), 'Invalid existing summary key');
    const key = `${row.month}:${row.kind}`;
    assert(!actual.has(key), 'Duplicate existing summary key');
    actual.add(key);
  }
  assert(expected.every(month => EXPECTED.kinds.every(kind => actual.has(`${month}:${kind}`))), 'Existing summary inventory differs from the immutable November 2024–October 2026 set');
  assert(actual.size === expected.length * EXPECTED.kinds.length && [...actual].every(key => expected.includes(key.split(':')[0])), 'Existing summary inventory includes an unexpected month');
  assert(Array.isArray(verifiedMonths), 'Verified month evidence must be an array');
  const verifiedByMonth = new Map();
  for (const evidence of verifiedMonths) {
    assert(evidence && typeof evidence === 'object' && !Array.isArray(evidence) && validMonth(evidence.month)
      && typeof evidence.state === 'string' && evidence.state.trim().length > 0
      && ['genuineScheduledReceipt', 'completeCoverage', 'supportedFinancialVersion'].every(key => typeof evidence[key] === 'boolean'),
    'Malformed verified month evidence');
    assert(!verifiedByMonth.has(evidence.month), 'Duplicate verified month evidence');
    assert(typeof evidence.financialVersionId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(evidence.financialVersionId)
      && typeof evidence.salesRevision === 'string' && /^[a-f0-9]{64}$/.test(evidence.salesRevision)
      && typeof evidence.costRevision === 'string' && /^[a-f0-9]{64}$/.test(evidence.costRevision),
    'Exact financial version and revisions required in verified month evidence');
    verifiedByMonth.set(evidence.month, evidence);
  }

  const nextUnpublishedMonth = nextMonth(EXPECTED.through);
  // The latest complete calendar month is always the month before the
  // observed date's month; day 1 also leaves the prior month as the last closed.
  const observedMonth = observedThroughLondon.slice(0, 7);
  const [y, m] = observedMonth.split('-').map(Number);
  const completeThrough = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const candidates = [];
  let predecessorsVerified = true;
  for (let month = nextUnpublishedMonth; month <= completeThrough; month = nextMonth(month)) {
    const evidence = verifiedByMonth.get(month);
    const verified = !!evidence && evidence.state === 'verified' && evidence.genuineScheduledReceipt === true
      && evidence.completeCoverage === true && evidence.supportedFinancialVersion === true
      && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(evidence.financialVersionId ?? '')
      && /^[a-f0-9]{64}$/.test(evidence.salesRevision ?? '')
      && /^[a-f0-9]{64}$/.test(evidence.costRevision ?? '');
    const eligible = predecessorsVerified && verified;
    candidates.push({ month, to: monthEnd(month), eligible, reason: !predecessorsVerified
      ? 'Waiting for preceding unpublished months to be verified; append only a contiguous prefix.'
      : verified
      ? 'Closed month has verified scheduled receipt and exact supported financial version.'
      : 'Waiting for a closed month, genuine scheduled receipt readback, complete coverage, and exact supported financial version.' });
    predecessorsVerified = eligible;
  }
  return Object.freeze({
    contract: 'synthetic-summary-refresh-proposal-v1',
    state: 'proposal-only',
    remoteApplied: false,
    observedThroughLondon,
    existingRowsProtected: { from: EXPECTED.from, through: EXPECTED.through, rows: 48, updateAllowed: false, invalidationAllowed: false },
    nextUnpublishedMonth,
    lastClosedMonth: completeThrough < nextUnpublishedMonth ? EXPECTED.through : completeThrough,
    candidates,
    refreshPolicy: 'Append one closed month at a time after genuine receipt and monthly financial-version readback. Use exact Cash and Acquisition summaries. The existing publisher may accept only a new key or byte-equivalent replay; correction/replacement is a separate reviewed workflow.',
    gates: [
      'Verify the actual scheduled financial feed run and its complete company-scoped receipt before summary compilation.',
      'Verify exact monthly financial version and sales/cost revisions for every period; never derive daily values from a month total.',
      'Refresh only complete London calendar months; keep a partial March 2027 period out of monthly publication.',
      'Keep the 48 November 2024–October 2026 summary rows immutable; no recreate, upsert, invalidation, or replacement.',
      'Review source corrections, customer observation windows, restricted read access, login expiry, and any scheduler continuation separately.',
    ],
  });
}
