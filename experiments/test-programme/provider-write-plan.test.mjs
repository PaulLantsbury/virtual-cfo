import test from 'node:test';
import assert from 'node:assert/strict';
import { shopifyOrderPlan, xeroInvoicePlan, executeProviderWrite } from './provider-write-plan.mjs';
const action = { kind: 'create-order', route: 'shopify-development', test: true, currency: 'GBP', targetStore: 'development.myshopify.com', amounts: { units: 1, grossProductsPence: 6000, productDiscountPence: 0, productVatPence: 0, netShippingPence: 0, shippingVatPence: 0 } };
const activation = { enabled: true, environment: 'staging', projectRef: 'bioalckltvkhlczusdvl', target: action.targetStore, verifiedTestTarget: true, startsAt: '2026-10-12T00:00:00Z', endsAt: '2026-10-26T00:00:00Z', cap: 10 };
test('Shopify request never charges, contacts, stocks or qualifies as merchant revenue', () => {
  const plan = shopifyOrderPlan(action);
  assert.equal(plan.variables.order.test, true);
  assert.deepEqual(plan.variables.options, { inventoryBehaviour: 'BYPASS', sendReceipt: false, sendFulfillmentReceipt: false });
  assert.equal(plan.variables.order.transactions, undefined);
  assert.equal(plan.variables.order.customer, undefined);
  assert.equal(plan.variables.order.lineItems[0].variantId, undefined);
  assert.equal(plan.financialEligibility, 'excluded-test-order');
  assert.throws(() => shopifyOrderPlan({ ...action, test: false }));
  assert.throws(() => shopifyOrderPlan({ ...action, amounts: { ...action.amounts, productDiscountPence: 1 } }));
});
test('Xero stable idempotency and draft/posted distinction with no payment or email', () => {
  const input = { target: '90000000-0000-4000-8000-000000000002', date: '2026-10-12', amountPence: 1000, contactId: '90000000-0000-4000-8000-000000000001', accountCode: '200', programmeId: 'staging-test', ordinal: 1 };
  const a = xeroInvoicePlan(input);
  assert.deepEqual(a, xeroInvoicePlan(input));
  assert.equal(a.requiredScope, 'accounting.invoices');
  assert.equal(a.body.Invoices[0].Status, 'DRAFT');
  assert.equal(a.financialEligibility, 'not-posted-to-profit-and-loss');
  assert.notEqual(a.actionKey, xeroInvoicePlan({ ...input, status: 'AUTHORISED' }).actionKey);
});
test('Unknown write outcome never replays; unsafe targets and nondurable ledger fail before write', async () => {
  let submitted = false, writes = 0, uncertain = false;
  const plan = shopifyOrderPlan(action);
  const ledger = { durable: true, claim: async () => ({ state: submitted ? 'existing' : 'claimed' }), markSubmitted: async () => { submitted = true; }, markUncertain: async () => { uncertain = true; } };
  const provider = { verifyTarget: async () => true, write: async () => { writes++; throw new Error('secret/raw error must not escape'); } };
  const opts = { plan, ledger, provider, activation, now: new Date('2026-10-12T18:00:00Z') };
  assert.equal((await executeProviderWrite(opts)).state, 'uncertain-stop');
  assert.equal(uncertain, true);
  assert.equal((await executeProviderWrite(opts)).state, 'reconciliation-required');
  assert.equal(writes, 1);
  await assert.rejects(executeProviderWrite({ ...opts, ledger: { ...ledger, durable: false } }));
  await assert.rejects(executeProviderWrite({ ...opts, activation: { ...activation, target: 'other' } }));
  await assert.rejects(executeProviderWrite({ ...opts, now: new Date('2026-10-26T00:00:00Z') }));
});
