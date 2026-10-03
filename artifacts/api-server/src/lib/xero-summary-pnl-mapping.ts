export const SUMMARY_PNL_LEAF_LINES = [
  'total_revenue',
  'cogs',
  'fulfilment_costs',
  'performance_marketing',
  'salaries',
  'other_overheads',
  'depreciation_amortisation',
  'interest',
  'tax',
] as const;

export const SUMMARY_PNL_DERIVED_LINES = [
  'cm1_gross_margin',
  'cm2_product_contribution',
  'cm3_marketing_contribution',
  'ebitda',
  'profit_before_tax',
  'profit_after_tax',
] as const;

export type SummaryPnlLeafLine = (typeof SUMMARY_PNL_LEAF_LINES)[number];
export type SummaryPnlDerivedLine = (typeof SUMMARY_PNL_DERIVED_LINES)[number];
export type SummaryPnlDisposition = 'mapped' | 'not_applicable';

export type SummaryPnlLineMapping = Readonly<{
  line: SummaryPnlLeafLine;
  disposition: SummaryPnlDisposition;
  accountIds: readonly string[];
}>;

export type SummaryPnlMapping = Readonly<{
  effectiveFrom: string;
  lines: readonly SummaryPnlLineMapping[];
}>;

export type SummaryPnlDraft = Readonly<{
  effectiveFrom: string;
  reviewRequired: true;
  lines: readonly Readonly<{
    line: SummaryPnlLeafLine;
    disposition: SummaryPnlDisposition | 'unresolved';
    accountIds: readonly string[];
  }>[];
}>;

export type LegacyXeroMapping = Readonly<{
  revenue: readonly string[];
  processingFee: readonly string[];
  advertising: readonly string[];
  software: readonly string[];
  includedCash: readonly string[];
}>;

export type SummaryPnlSuggestion = Readonly<{
  line: SummaryPnlLeafLine;
  accountId: string;
  confidence: 'low' | 'medium' | 'high';
  rationale: readonly string[];
  status: 'review_required';
}>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_ID = /^.{1,256}$/u;

export function validateSummaryPnlMapping(value: unknown): SummaryPnlMapping | null {
  if (!plain(value) || !exactKeys(value, ['effectiveFrom', 'lines'])) return null;
  if (!validDay(value.effectiveFrom) || !Array.isArray(value.lines)) return null;
  if (value.lines.length !== SUMMARY_PNL_LEAF_LINES.length) return null;

  const seenLines = new Set<string>();
  const seenAccounts = new Set<string>();
  const lines: SummaryPnlLineMapping[] = [];

  for (const candidate of value.lines) {
    if (!plain(candidate) || !exactKeys(candidate, ['line', 'disposition', 'accountIds'])) return null;
    if (!isLeaf(candidate.line) || seenLines.has(candidate.line)) return null;
    if (candidate.disposition !== 'mapped' && candidate.disposition !== 'not_applicable') return null;
    if (!Array.isArray(candidate.accountIds) || !candidate.accountIds.every(validAccountId)) return null;
    if (candidate.disposition === 'mapped' && candidate.accountIds.length === 0) return null;
    if (candidate.disposition === 'not_applicable' && candidate.accountIds.length !== 0) return null;
    for (const accountId of candidate.accountIds) {
      if (seenAccounts.has(accountId)) return null;
      seenAccounts.add(accountId);
    }
    seenLines.add(candidate.line);
    lines.push(Object.freeze({
      line: candidate.line,
      disposition: candidate.disposition,
      accountIds: Object.freeze([...candidate.accountIds]),
    }));
  }
  if (!SUMMARY_PNL_LEAF_LINES.every(line => seenLines.has(line))) return null;
  return Object.freeze({effectiveFrom: value.effectiveFrom, lines: Object.freeze(lines)});
}

/**
 * Produces a review-required draft from the deployed five-category mapping.
 * Included cash remains a balance-sheet mapping and is deliberately excluded.
 * The adapter never confirms a mapping and never guesses missing P&L lines.
 */
export function legacyMappingToSummaryPnlDraft(
  mapping: LegacyXeroMapping,
  effectiveFrom: string,
): SummaryPnlDraft | null {
  if (!validLegacy(mapping) || !validDay(effectiveFrom)) return null;
  const seeded: Partial<Record<SummaryPnlLeafLine, readonly string[]>> = {
    total_revenue: mapping.revenue,
    fulfilment_costs: mapping.processingFee,
    performance_marketing: mapping.advertising,
    other_overheads: mapping.software,
  };
  const lines = SUMMARY_PNL_LEAF_LINES.map(line => Object.freeze({
    line,
    disposition: (seeded[line]?.length ? 'mapped' : 'unresolved') as SummaryPnlDisposition | 'unresolved',
    accountIds: Object.freeze([...(seeded[line] ?? [])]),
  }));
  return Object.freeze({effectiveFrom, reviewRequired: true, lines: Object.freeze(lines)});
}

export function validateSummaryPnlSuggestions(value: unknown): readonly SummaryPnlSuggestion[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const seen = new Set<string>();
  const suggestions: SummaryPnlSuggestion[] = [];
  for (const candidate of value) {
    if (!plain(candidate) || !exactKeys(candidate, ['line', 'accountId', 'confidence', 'rationale', 'status'])) return null;
    if (!isLeaf(candidate.line) || !validAccountId(candidate.accountId)) return null;
    if (!['low', 'medium', 'high'].includes(candidate.confidence) || candidate.status !== 'review_required') return null;
    if (!Array.isArray(candidate.rationale) || candidate.rationale.length < 1 || candidate.rationale.length > 8 || !candidate.rationale.every(validReason)) return null;
    const key = `${candidate.line}\0${candidate.accountId}`;
    if (seen.has(key)) return null;
    seen.add(key);
    suggestions.push(Object.freeze({...candidate, rationale: Object.freeze([...candidate.rationale])}) as SummaryPnlSuggestion);
  }
  return Object.freeze(suggestions);
}

/** Expenses are positive magnitudes; derived totals are deterministic and never mapped. */
export function deriveSummaryPnl(values: Readonly<Record<SummaryPnlLeafLine, number>>) {
  if (!plain(values) || !exactKeys(values, [...SUMMARY_PNL_LEAF_LINES])) return null;
  if (!SUMMARY_PNL_LEAF_LINES.every(line => Number.isSafeInteger(values[line]))) return null;
  const cm1 = values.total_revenue - values.cogs;
  const cm2 = cm1 - values.fulfilment_costs;
  const cm3 = cm2 - values.performance_marketing;
  const ebitda = cm3 - values.salaries - values.other_overheads;
  const profitBeforeTax = ebitda - values.depreciation_amortisation - values.interest;
  return Object.freeze({
    cm1_gross_margin: cm1,
    cm2_product_contribution: cm2,
    cm3_marketing_contribution: cm3,
    ebitda,
    profit_before_tax: profitBeforeTax,
    profit_after_tax: profitBeforeTax - values.tax,
  });
}

function validLegacy(value: unknown): value is LegacyXeroMapping {
  return plain(value) && exactKeys(value, ['revenue', 'processingFee', 'advertising', 'software', 'includedCash']) &&
    ['revenue', 'processingFee', 'advertising', 'software', 'includedCash'].every(key =>
      Array.isArray(value[key]) && value[key].length > 0 && value[key].every(validAccountId));
}
function isLeaf(value: unknown): value is SummaryPnlLeafLine { return SUMMARY_PNL_LEAF_LINES.includes(value as SummaryPnlLeafLine); }
function validAccountId(value: unknown): value is string { return typeof value === 'string' && ACCOUNT_ID.test(value.trim()); }
function validReason(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= 240; }
function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function plain(value: unknown): value is Record<string, any> { return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value: Record<string, any>, keys: readonly string[]) { return Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
