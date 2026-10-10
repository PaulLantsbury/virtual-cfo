import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUMMARY_PNL_LEAF_LINES,
  deriveSummaryPnl,
  legacyMappingToSummaryPnlDraft,
  validateSummaryPnlMapping,
  validateSummaryPnlSuggestions,
} from '../src/lib/xero-summary-pnl-mapping.ts';

const ids = Object.fromEntries(SUMMARY_PNL_LEAF_LINES.map((line, index) => [line, `account-${index + 1}`]));
const complete = {
  effectiveFrom: '2026-10-01',
  lines: SUMMARY_PNL_LEAF_LINES.map(line => ({line, disposition: 'mapped', accountIds: [ids[line]]})),
};

test('accepts many accounts per leaf while enforcing one leaf per account', () => {
  const valid = structuredClone(complete);
  valid.lines[0].accountIds.push('second-sales-account');
  assert.ok(validateSummaryPnlMapping(valid));
  const duplicate = structuredClone(valid);
  duplicate.lines[1].accountIds = ['second-sales-account'];
  assert.equal(validateSummaryPnlMapping(duplicate), null);
});

test('requires every leaf to be explicitly mapped or marked not applicable', () => {
  const explicit = structuredClone(complete);
  explicit.lines.at(-1).disposition = 'not_applicable';
  explicit.lines.at(-1).accountIds = [];
  assert.ok(validateSummaryPnlMapping(explicit));
  assert.equal(validateSummaryPnlMapping({...complete, lines: complete.lines.slice(1)}), null);
  assert.equal(validateSummaryPnlMapping({...complete, lines: [...complete.lines, complete.lines[0]]}), null);
});

test('adapts the deployed five categories into an unconfirmed review draft', () => {
  const draft = legacyMappingToSummaryPnlDraft({
    revenue: ['sales', 'shipping'], processingFee: ['merchant-fees'], advertising: ['ads'],
    software: ['subscriptions'], includedCash: ['bank'],
  }, '2026-10-01');
  assert.deepEqual(draft.lines.find(line => line.line === 'total_revenue').accountIds, ['sales', 'shipping']);
  assert.deepEqual(draft.lines.find(line => line.line === 'fulfilment_costs').accountIds, ['merchant-fees']);
  assert.deepEqual(draft.lines.find(line => line.line === 'performance_marketing').accountIds, ['ads']);
  assert.deepEqual(draft.lines.find(line => line.line === 'other_overheads').accountIds, ['subscriptions']);
  assert.equal(draft.reviewRequired, true);
  assert.equal(draft.lines.find(line => line.line === 'cogs').disposition, 'unresolved');
  assert.equal(validateSummaryPnlMapping(draft), null);
  assert.equal(JSON.stringify(draft).includes('bank'), false);
});

test('suggestions are review-only, bounded and explainable', () => {
  const suggestions = [{line: 'cogs', accountId: '310', confidence: 'high', rationale: ['Xero type is DIRECTCOSTS', 'name contains cost of goods'], status: 'review_required'}];
  assert.deepEqual(validateSummaryPnlSuggestions(suggestions), suggestions);
  assert.equal(validateSummaryPnlSuggestions([{...suggestions[0], status: 'accepted'}]), null);
  assert.equal(validateSummaryPnlSuggestions([{...suggestions[0], rationale: []}]), null);
});

test('derives subtotals once from positive expense magnitudes', () => {
  assert.deepEqual(deriveSummaryPnl({
    total_revenue: 100_000, cogs: 40_000, fulfilment_costs: 10_000,
    performance_marketing: 15_000, salaries: 12_000, other_overheads: 3_000,
    depreciation_amortisation: 2_000, interest: 1_000, tax: 4_000,
  }), {
    cm1_gross_margin: 60_000,
    cm2_product_contribution: 50_000,
    cm3_marketing_contribution: 35_000,
    ebitda: 20_000,
    profit_before_tax: 17_000,
    profit_after_tax: 13_000,
  });
});
