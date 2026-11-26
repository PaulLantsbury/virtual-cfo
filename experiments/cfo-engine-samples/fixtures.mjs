/** Explicit fictional acceptance cases, never the published synthetic company. */
import { makeFictionalInput, FICTIONAL_SCOPE } from '../cfo-commentary/fixtures.mjs';
import { calculateProfitEvidence, PROFIT_EVIDENCE_VERSION } from '../financial-v1/profit-evidence.mjs';

export const SAMPLE_CASES = Object.freeze([
  'normal', 'missing-costs', 'missing-advertising', 'missing-overheads',
  'missing-cash', 'missing-customer', 'stale', 'invalidated', 'denied',
  'scope-mismatch', 'comparison-mismatch', 'zero', 'negative', 'prompt-injection',
]);
export const SAMPLE_NAME = 'Fictional Northbridge Home Ltd';
export const SAMPLE_NOTICE = 'Fictional acceptance examples. These figures are not the published Night Scout synthetic company, real provider data, or ChatGPT responses.';
const KEYS = ['netProductSales', 'netShipping', 'cogs', 'variableCosts', 'advertising', 'overheads', 'da', 'grossProfit', 'contributionBeforeMarketing', 'contribution', 'operatingProfit', 'ebitda'];

export function makeSampleCase(name) {
  if (!SAMPLE_CASES.includes(name)) throw new Error('Unknown sample case');
  const fixture = makeFictionalInput(['missing-customer', 'scope-mismatch'].includes(name) ? 'normal' : name);
  const scope = { ...FICTIONAL_SCOPE, from: '2026-10-01', to: '2026-10-31', selectionVersion: 'fictional-october-selection-v1' };
  const expected = { ...scope, asOf: '2026-11-26', access: fixture.access, formulaVersion: PROFIT_EVIDENCE_VERSION };
  const sources = [], metrics = [];
  for (const period of ['current', 'prior']) {
    const record = fixture[period];
    const id = `fictional-${period}-profit`;
    sources.push({ id, ref: `fictional-ledger-${period}`, scope: { ...scope, from: record.from, to: record.to }, from: record.from, to: record.to,
      reportVersion: record.reportVersion, sourceVersion: record.sourceVersion,
      formulaVersion: record.formulaVersion, observedAt: record.observedAt,
      dataThrough: record.dataThrough, profitInput: record.profitInput });
    const calculated = calculateProfitEvidence(record.profitInput);
    for (const key of KEYS) {
      const value = ['netProductSales', 'netShipping'].includes(key) ? calculated.sales?.[key] ?? null : calculated[key]?.value ?? null;
      metrics.push({ id: `${period}-${key}`, key, unit: 'pence', period, value, sourceId: id });
    }
  }
  if (name === 'scope-mismatch') expected.companyId = 'fictional-other-company';
  const input = { schemaVersion: 'cfo-evidence-v1', scope, mode: 'fictional', freshness: fixture.current.freshness, sources, metrics, testPlan: null };
  return { name, expected, input };
}
