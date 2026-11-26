/** Deterministic prose from accepted shared-engine claims. No model or live adapter. */
import { createEvidenceContext, evaluateClaim, validateClaimResult } from '../../lib/cfo-engine/index.mjs';
import { makeSampleCase, SAMPLE_NAME, SAMPLE_NOTICE } from './fixtures.mjs';

const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value / 100);
const titles = {
  normal: 'Profit increased in the fictional example',
  'missing-costs': 'Product costs are missing',
  'missing-advertising': 'Advertising evidence is incomplete',
  'missing-overheads': 'Supported trading figures remain visible',
  'missing-cash': 'Profit does not establish cash available',
  'missing-customer': 'Order totals cannot answer customer questions',
  stale: 'Saved figures need a freshness check',
  invalidated: 'Withdrawn evidence is not reused',
  denied: 'Access is required before showing figures',
  'scope-mismatch': 'Another company’s figures are withheld',
  'comparison-mismatch': 'Current figures survive a missing comparison',
  zero: 'A supported zero stays distinct from missing data',
  negative: 'A refund-only period can be negative',
  'prompt-injection': 'Source notes cannot change the advice rules',
};

export function buildBriefing(name) {
  const example = makeSampleCase(name);
  const context = createEvidenceContext(example.input, example.expected);
  const decisions = [];
  function decide(intent) {
    const result = evaluateClaim(context, intent);
    if (!validateClaimResult(context, intent, result)) throw new Error('Shared engine result failed validation');
    decisions.push({ intent, result });
    return result;
  }
  const facts = Object.fromEntries(['netProductSales', 'grossProfit', 'contribution', 'operatingProfit', 'advertising'].map(key => [key, decide({ kind: 'fact', metricId: `current-${key}` })]));
  const change = decide({ kind: 'arithmetic', currentId: 'current-operatingProfit', priorId: 'prior-operatingProfit' });
  const cash = decide({ kind: 'fact', metricId: 'current-availableCash' });
  const customers = decide({ kind: 'fact', metricId: 'current-repeatCustomers' });
  const investigation = decide({ kind: 'investigation', topic: 'profit-change', metricIds: ['current-grossProfit', 'current-contribution', 'current-operatingProfit', 'current-ebitda'] });
  const marketingTest = decide({ kind: 'conditional-test', topic: 'marketing-economics', metricIds: ['current-advertising', 'current-contribution'] });
  const value = result => result.status === 'supported' && result.claims.length === 1 && result.claims[0].unit === 'pence' ? result.claims[0].value : null;
  const statements = [];
  if (context.status === 'withheld') {
    statements.push('This request has no eligible evidence. No figures or advice from a previous company or withdrawn result are shown.');
    statements.push('Next check: confirm access, the selected company and the current approved evidence before asking again.');
  } else {
    if (context.status === 'stale') statements.push('These are the saved October figures, marked stale. They are not a newly verified result.');
    const sales = value(facts.netProductSales), gross = value(facts.grossProfit), contribution = value(facts.contribution), operating = value(facts.operatingProfit);
    if (sales !== null) statements.push(`October net product sales were ${money(sales)}, excluding VAT and shipping.`);
    if (gross !== null) statements.push(`Gross profit was ${money(gross)}.`);
    if (contribution !== null) statements.push(`Contribution after advertising was ${money(contribution)}.`);
    if (operating !== null) statements.push(`Operating profit was ${money(operating)}, after the supported operating costs.`);
    else statements.push('Operating profit is unavailable because some of its required evidence is missing or incompatible.');
    const movement = value(change);
    if (movement !== null) {
      statements.push(`Operating profit ${movement > 0 ? 'increased' : movement < 0 ? 'decreased' : 'was unchanged'}${movement === 0 ? '' : ` by ${money(Math.abs(movement))}`} compared with September. This is an arithmetic comparison; it does not establish the business cause.`);
    } else statements.push('The profit comparison is withheld; the two periods are not both eligible for this comparison.');
    if (name === 'missing-costs') statements.push('Next check: complete the historical product-cost evidence before drawing a margin conclusion.');
    else if (name === 'missing-advertising') statements.push('Next check: complete advertising evidence. Missing spend has not been replaced with zero.');
    else if (name === 'missing-overheads') statements.push('Next check: complete overhead evidence before relying on a business-profit conclusion.');
    else if (name === 'stale') statements.push('Next check: refresh and review the same reporting scope before relying on a new trend or action.');
    else if (name === 'comparison-mismatch') statements.push('Next check: use a September comparison with matching financial definitions and valid evidence.');
    else if (investigation.status === 'supported') statements.push(...investigation.text);
    else statements.push('Next check: review the underlying sales and cost evidence before deciding what to change.');
    if (cash.status !== 'supported') statements.push('Cash available is unknown: dated eligible cash balances are not supplied. Profit does not show what is safe to spend.');
    if (name === 'missing-customer' && customers.status !== 'supported') statements.push('Repeat customers and customer acquisition economics are unavailable. These sales and cost figures contain no validated customer population or matched acquisition evidence.');
    if (marketingTest.status !== 'supported') statements.push('A marketing-spend test is not proposed: the required assumptions, downside checks and measurement plan are absent.');
  }
  return { name, title: titles[name], company: SAMPLE_NAME, notice: SAMPLE_NOTICE, reportingPeriod: 'October 2026', comparisonPeriod: 'September 2026', currency: 'GBP', timeZone: 'Europe/London', sourceObservedAt: '2026-11-01T12:00:00Z', dataThrough: '2026-10-31', reviewDate: '2026-11-26', status: context.status, statements, decisions };
}

/** Exact deterministic rendering check; edited/invented narrative is not accepted. */
export function validateBriefing(name, candidate) {
  try { return JSON.stringify(buildBriefing(name)) === JSON.stringify(candidate); }
  catch { return false; }
}
