import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBriefing, validateBriefing } from './briefings.mjs';
import { makeSampleCase, SAMPLE_CASES } from './fixtures.mjs';
import { calculateProfitEvidence } from '../financial-v1/profit-evidence.mjs';

function decision(sample, key) { return sample.decisions.find(x => x.intent.kind === 'fact' && x.intent.metricId === key)?.result; }

test('all fixtures are explicitly fictional, locally reproducible and canonically validated', () => {
 for (const name of SAMPLE_CASES) {
  const sample = buildBriefing(name);
  assert.equal(validateBriefing(name, sample), true);
  assert.match(sample.notice, /not the published Night Scout synthetic company/);
  assert.match(sample.company, /^Fictional/);
  assert.equal(makeSampleCase(name).input.mode, 'fictional');
  assert.equal(sample.decisions.every(x => x.result.canExecute === false), true);
 }
});

test('October and September operating profit agree with unchanged shared calculator', () => {
 const fixture = makeSampleCase('normal');
 const expected = fixture.input.sources.map(source => calculateProfitEvidence(source.profitInput));
 assert.equal(expected[0].operatingProfit.value, 350000);
 assert.equal(expected[1].operatingProfit.value, 270000);
 const sample = buildBriefing('normal');
 assert.equal(decision(sample, 'current-operatingProfit').claims[0].value, 350000);
 const movement = sample.decisions.find(x => x.intent.kind === 'arithmetic').result;
 assert.equal(movement.status, 'supported');
 assert.equal(movement.claims[0].value, 80000);
 assert.match(sample.statements.join('\n'), /£3,500.00/);
 assert.match(sample.statements.join('\n'), /increased by £800.00/);
 assert.match(sample.statements.join('\n'), /does not establish the business cause/);
 assert.equal(sample.decisions.find(x => x.intent.kind === 'investigation').result.status, 'supported');
});

test('missing overheads preserve supported gross profit and contribution but withhold operating profit', () => {
 const sample = buildBriefing('missing-overheads');
 assert.equal(decision(sample, 'current-grossProfit').status, 'supported');
 assert.equal(decision(sample, 'current-contribution').status, 'supported');
 assert.equal(decision(sample, 'current-operatingProfit').status, 'withheld');
 assert.match(sample.statements.join('\n'), /Operating profit is unavailable/);
 assert.doesNotMatch(sample.statements.join('\n'), /Operating profit was/);
});

test('missing product costs and advertising are never replaced with zeros', () => {
 const costs = buildBriefing('missing-costs');
 assert.equal(decision(costs, 'current-netProductSales').status, 'supported');
 assert.equal(decision(costs, 'current-grossProfit').status, 'withheld');
 const ads = buildBriefing('missing-advertising');
 assert.equal(decision(ads, 'current-grossProfit').status, 'supported');
 assert.equal(decision(ads, 'current-advertising').status, 'withheld');
 assert.equal(decision(ads, 'current-contribution').status, 'withheld');
});

test('missing cash and customer populations withhold dependent advice', () => {
 const cash = buildBriefing('missing-cash');
 assert.equal(decision(cash, 'current-availableCash').status, 'withheld');
 assert.match(cash.statements.join('\n'), /Cash available is unknown/);
 const customers = buildBriefing('missing-customer');
 assert.equal(decision(customers, 'current-repeatCustomers').status, 'withheld');
 assert.match(customers.statements.join('\n'), /no validated customer population/);
 assert.equal(customers.decisions.find(x => x.intent.kind === 'conditional-test').result.status, 'requires-human-review');
});

test('stale evidence is labelled and cannot produce current movement or advice', () => {
 const sample = buildBriefing('stale');
 assert.equal(sample.status, 'stale');
 assert.match(sample.statements.join('\n'), /marked stale/);
 assert.equal(sample.decisions.find(x => x.intent.kind === 'arithmetic').result.status, 'withheld');
 assert.doesNotMatch(sample.statements.join('\n'), /increased by/);
});

test('denied, invalidated and wrong-company contexts disclose no numerical claims', () => {
 for (const name of ['denied', 'invalidated', 'scope-mismatch']) {
  const sample = buildBriefing(name);
  assert.equal(sample.status, 'withheld');
  assert.equal(sample.decisions.every(x => x.result.claims.length === 0), true);
  assert.doesNotMatch(sample.statements.join('\n'), /£/);
 }
});

test('incompatible comparison does not suppress supported current figures', () => {
 const sample = buildBriefing('comparison-mismatch');
 assert.equal(decision(sample, 'current-operatingProfit').status, 'supported');
 assert.equal(sample.decisions.find(x => x.intent.kind === 'arithmetic').result.status, 'withheld');
 assert.match(sample.statements.join('\n'), /£3,500.00/);
});

test('verified zero and refund-only negative periods remain explicit', () => {
 const zero = buildBriefing('zero'), negative = buildBriefing('negative');
 assert.equal(decision(zero, 'current-operatingProfit').claims[0].value, 0);
 assert.equal(decision(negative, 'current-operatingProfit').claims[0].value, -7500);
 assert.match(zero.statements.join('\n'), /£0.00/);
 assert.match(negative.statements.join('\n'), /-£75.00/);
});

test('source-note instructions never appear in prose and edited numbers fail canonical rendering', () => {
 const sample = buildBriefing('prompt-injection');
 assert.doesNotMatch(JSON.stringify(sample.statements), /attacker|increase.*50%|Send bank/);
 const forged = structuredClone(buildBriefing('normal'));
 forged.statements[0] = 'October net product sales were £1,000,000.00.';
 assert.equal(validateBriefing('normal', forged), false);
});
