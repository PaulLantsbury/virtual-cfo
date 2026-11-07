import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const money = value => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000) throw new Error('Invalid bounded amount');
  return (value / 100).toFixed(2);
};

// Pure request preparation. This module has no credentials, fetch or scheduler.
export function shopifyOrderPlan(action) {
  if (action?.kind !== 'create-order' || action.route !== 'shopify-development' || action.test !== true || action.currency !== 'GBP') throw new Error('Test-only Shopify action required');
  const a = action.amounts;
  if (!a || !Number.isInteger(a.units) || a.units < 1 || a.units > 2 || a.productDiscountPence !== 0 || a.productVatPence !== 0 || a.netShippingPence !== 0 || a.shippingVatPence !== 0) throw new Error('Only verified zero-tax/no-shipping scenario supported; other scenarios require separate adapter');
  const key = `ns-${digest(action).slice(0, 40)}`;
  return freeze({ provider: 'shopify', actionKey: key, target: action.targetStore,
    operation: 'orderCreate', variables: {
      order: { currency: 'GBP', test: true, buyerAcceptsMarketing: false, taxesIncluded: false,
        tags: ['night-scout-test-programme', key], sourceIdentifier: key,
        lineItems: [{ title: 'Night Scout synthetic non-stock item', quantity: a.units,
          requiresShipping: false, taxable: false,
          priceSet: { shopMoney: { amount: money(a.grossProductsPence / a.units), currencyCode: 'GBP' } } }],
      }, options: { inventoryBehaviour: 'BYPASS', sendReceipt: false, sendFulfillmentReceipt: false },
    }, financialEligibility: 'excluded-test-order', confirmationRequires: ['test=true', 'GBP', 'exact-tag', 'amounts', 'no-transactions', 'unfulfilled'] });
}

export function xeroInvoicePlan({ target, date, amountPence, contactId, accountCode, programmeId, ordinal, status = 'DRAFT' }) {
  if (!/^[0-9a-f-]{36}$/i.test(target)) throw new Error('Exact Xero tenant required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
  if (!/^[0-9a-f-]{36}$/i.test(contactId) || !/^[A-Za-z0-9_-]{1,20}$/.test(accountCode) || !/^[A-Za-z0-9/_-]{1,128}$/.test(programmeId) || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 14 || !['DRAFT', 'AUTHORISED'].includes(status)) throw new Error('Invalid bounded invoice plan');
  const key = `ns-${digest({ target, date, amountPence, contactId, accountCode, programmeId, ordinal, status }).slice(0, 40)}`;
  return freeze({ provider: 'xero', target, actionKey: key, operation: 'create-invoice', requiredScope: 'accounting.invoices',
    headers: { 'Idempotency-Key': key }, body: { Invoices: [{ Type: 'ACCREC', Contact: { ContactID: contactId }, Date: date,
      DueDate: date, CurrencyCode: 'GBP', Status: status, LineAmountTypes: 'NoTax', InvoiceNumber: key,
      Reference: 'Night Scout synthetic test programme', LineItems: [{ Description: 'Synthetic test non-stock service', Quantity: 1, UnitAmount: Number(money(amountPence)), AccountCode: accountCode }] }] },
    financialEligibility: status === 'DRAFT' ? 'not-posted-to-profit-and-loss' : 'demo-organisation-only',
    forbiddenOperations: ['email-invoice', 'payment', 'fulfilment', 'inventory', 'create-contact'] });
}

// Ledger methods must be atomic/durable; a process-local Map is never an activation adapter.
// claim returns claimed/existing/blocked; existing submitted/uncertain claims always reconcile.
export async function executeProviderWrite({ plan, ledger, provider, activation, now = new Date() }) {
  if (!plan || !['shopify','xero'].includes(plan.provider) || typeof plan.actionKey !== 'string' || !/^ns-[0-9a-f]{40}$/.test(plan.actionKey)) throw new Error('Invalid prepared plan');
  if (activation?.enabled !== true || activation.environment !== 'staging' || activation.projectRef !== 'bioalckltvkhlczusdvl' || activation.target !== plan.target || activation.verifiedTestTarget !== true) throw new Error('Verified staging activation required');
  if (!Number.isInteger(activation.cap) || activation.cap < 1 || activation.cap > 14 || Date.parse(activation.endsAt) - Date.parse(activation.startsAt) > 14 * 86400000) throw new Error('Invalid bounded cap/window');
  const timestamp = now.valueOf();
  if (!Number.isFinite(timestamp) || timestamp < Date.parse(activation.startsAt) || timestamp >= Date.parse(activation.endsAt) || !Number.isFinite(Date.parse(activation.startsAt)) || !Number.isFinite(Date.parse(activation.endsAt))) throw new Error('Outside bounded activation');
  if (ledger?.durable !== true) throw new Error('Durable ledger required');
  if (!await provider.verifyTarget(activation)) throw new Error('Provider target mismatch');
  const payloadDigest = digest(plan);
  const claim = await ledger.claim({ key: plan.actionKey, provider: plan.provider, target: activation.target, payloadDigest, cap: activation.cap });
  if (claim.state !== 'claimed') return Object.freeze({ state: 'reconciliation-required', actionKey: plan.actionKey });
  // Persist before calling provider: a crash after this point cannot cause blind replay.
  await ledger.markSubmitted(plan.actionKey);
  try {
    const result = await provider.write(plan);
    if (!await provider.verifyResult(plan, result)) throw new Error('Unverified write response');
    await ledger.confirm(plan.actionKey, result.sourceId);
    return Object.freeze({ state: 'confirmed', actionKey: plan.actionKey });
  } catch {
    await ledger.markUncertain(plan.actionKey);
    return Object.freeze({ state: 'uncertain-stop', actionKey: plan.actionKey });
  }
}
