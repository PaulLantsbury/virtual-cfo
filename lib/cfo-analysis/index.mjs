import { createEvidenceContext, evaluateClaim, POLICY_VERSION } from '../cfo-engine/index.mjs';
import { PROFIT_EVIDENCE_VERSION } from '../../experiments/financial-v1/profit-evidence.mjs';

const labels = Object.freeze({ netProductSales: 'Net product sales', netShipping: 'Net shipping revenue', cogs: 'Cost of goods sold', variableCosts: 'Variable operating costs', advertising: 'Advertising', overheads: 'Operating overheads (including depreciation and amortisation)', da: 'Depreciation and amortisation', grossProfit: 'Gross profit', contributionBeforeMarketing: 'Contribution before advertising', contribution: 'Contribution after advertising', operatingProfit: 'Operating profit', ebitda: 'EBITDA' });
const components = Object.freeze({ netProductSales: 1, netShipping: 1, cogs: -1, variableCosts: -1, advertising: -1, overheads: -1 });
const required = [...Object.keys(components), 'grossProfit', 'contribution', 'operatingProfit', 'ebitda'];
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function money(pence, currency) {
  const absolute = BigInt(pence < 0 ? -pence : pence);
  const format = new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return format.formatToParts(pence < 0 ? -0 : 0).map(part => part.type === 'integer' ? (absolute / 100n).toLocaleString('en-GB') : part.type === 'fraction' ? String(absolute % 100n).padStart(2, '0') : part.value).join('');
}
const month = value => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
function sumExact(values) { let total = 0; for (const value of values) { total += value; if (!Number.isSafeInteger(total)) return null; } return total; }

/** Pure server-side analysis. Authorization and source freshness are supplied by the trusted reader. */
export function analyzeFinancialChange(input, expected) {
  const context = createEvidenceContext(input, expected);
  const result = {
    schemaVersion: 'cfo-analysis-v1', status: 'withheld', mode: context.mode,
    scope: context.scope, policyVersion: POLICY_VERSION.version, formulaVersion: PROFIT_EVIDENCE_VERSION,
    headline: 'Financial change analysis is unavailable.', explanation: '', facts: [], bridge: [], sources: [],
    investigation: null, limitation: 'Missing evidence is not treated as zero.', reason: context.reason, canExecute: false,
  };
  if (context.status === 'withheld') return freeze(result);
  const prefix = context.mode === 'fictional' ? 'Fictional example. ' : '';
  // Never expose raw source records, customer data, or source-supplied narrative.
  const pairs = new Map();
  for (const [key, label] of Object.entries(labels)) {
    const current = context.metrics.find(m => m.key === key && m.period === 'current');
    const prior = context.metrics.find(m => m.key === key && m.period === 'prior');
    if (!current) continue;
    const fact = evaluateClaim(context, { kind: 'fact', metricId: current.id });
    if (fact.status !== 'supported') continue;
    const row = { key, label, currentPence: fact.claims[0].value, priorPence: null, changePence: null, currentMetricId: current.id, priorMetricId: null, evidenceRefs: [...fact.claims[0].evidenceRefs] };
    result.facts.push(row);
    if (prior) {
      const change = evaluateClaim(context, { kind: 'arithmetic', currentId: current.id, priorId: prior.id });
      if (change.status === 'supported') pairs.set(key, { ...row, priorPence: prior.value, changePence: change.claims[0].value, priorMetricId: prior.id, evidenceRefs: [...change.claims[0].evidenceRefs] });
    }
  }
  const currentSourceIds = new Set(context.metrics.filter(m => result.facts.some(row => row.currentMetricId === m.id)).map(m => m.sourceId));
  const projectSource = ({ id, ref, from, to, reportVersion, sourceVersion, formulaVersion, observedAt, dataThrough }) => ({ id, ref, from, to, reportVersion, sourceVersion, formulaVersion, observedAt, dataThrough });
  result.sources = context.sources.filter(source => currentSourceIds.has(source.id)).map(projectSource);
  if (context.status === 'stale') {
    result.headline = `${prefix}Refresh the evidence before comparing months.`;
    result.reason = 'stale-evidence';
    result.limitation = 'These are dated historical figures. Stale evidence cannot support a new comparison or investigation.';
    return freeze(result);
  }
  if (!required.every(key => pairs.has(key))) {
    result.headline = `${prefix}A complete profit comparison is not available yet.`;
    result.reason = 'incomplete-comparable-evidence';
    result.limitation = 'Supported current-month figures remain available. Complete matching sales and cost evidence for both months before explaining the profit movement.';
    return freeze(result);
  }
  const bridge = Object.entries(components).map(([key, sign]) => ({ ...pairs.get(key), profitEffectPence: sign * pairs.get(key).changePence }));
  const profit = pairs.get('operatingProfit');
  // This reconciles the existing calculation; it does not introduce a new profit definition.
  const currentTotal = sumExact(bridge.map(row => row.currentPence * components[row.key]));
  const priorTotal = sumExact(bridge.map(row => row.priorPence * components[row.key]));
  const changeTotal = sumExact(bridge.map(row => row.profitEffectPence));
  if (currentTotal !== profit.currentPence || priorTotal !== profit.priorPence || changeTotal !== profit.changePence) {
    result.reason = 'profit-bridge-does-not-reconcile';
    result.limitation = 'The recorded component changes do not safely reconcile to operating profit. Review the underlying evidence.';
    return freeze(result);
  }
  const investigationClaim = evaluateClaim(context, { kind: 'investigation', topic: 'profit-change', metricIds: ['grossProfit', 'contribution', 'operatingProfit', 'ebitda'].map(key => pairs.get(key).currentMetricId) });
  if (investigationClaim.status !== 'supported') { result.reason = 'investigation-evidence-unavailable'; return freeze(result); }
  const currency = context.scope.currency;
  const currentMonth = month(context.scope.from);
  const priorSource = context.sources.find(s => s.id === context.metrics.find(m => m.id === profit.priorMetricId).sourceId);
  const priorMonth = month(priorSource.from);
  const direction = profit.changePence > 0 ? 'increased' : 'decreased';
  const currentFacts = result.facts;
  result.status = 'ready'; result.reason = null;
  result.facts = result.facts.map(row => pairs.get(row.key) ?? row);
  result.bridge = bridge;
  result.headline = profit.changePence === 0
    ? `${prefix}Operating profit was unchanged at ${money(profit.currentPence, currency)} in ${currentMonth}.`
    : `${prefix}Operating profit ${direction} by ${money(Math.abs(profit.changePence), currency)} to ${money(profit.currentPence, currency)} in ${currentMonth}.`;
  const up = sumExact(bridge.filter(row => row.profitEffectPence > 0).map(row => row.profitEffectPence));
  const down = sumExact(bridge.filter(row => row.profitEffectPence < 0).map(row => -row.profitEffectPence));
  if (up === null || down === null) {
    result.status = 'withheld'; result.reason = 'profit-bridge-exceeds-supported-precision'; result.bridge = []; result.facts = currentFacts; result.headline = 'Financial change analysis is unavailable.'; return freeze(result);
  }
  result.sources = context.sources.map(projectSource);
  result.explanation = `Compared with ${priorMonth}, recorded sales and cost movements added ${money(up, currency)} and offset ${money(down, currency)} of operating profit. The six components reconcile exactly to the ${money(profit.changePence, currency)} net change.`;
  // Largest absolute recorded movement is a transparent review focus, not an opportunity or benefit ranking.
  const focus = bridge.reduce((best, row) => Math.abs(row.profitEffectPence) > Math.abs(best?.profitEffectPence ?? 0) ? row : best, null);
  if (focus) {
    result.investigation = {
      id: 'review-profit-components',
      text: `Check the records behind ${focus.label.toLowerCase()}, which changed by ${money(focus.changePence, currency)}. This is the largest absolute component movement in this comparison. Confirm the period and classification before deciding whether any commercial change is warranted.`,
      evidenceRefs: [...focus.evidenceRefs],
    };
  }
  result.limitation = 'This explains the recorded arithmetic, not its business cause. It does not establish savings, future performance or cash available to spend.';
  return freeze(result);
}
