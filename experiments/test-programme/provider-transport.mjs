const exact = (value, keys) => value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).sort().join(',')===keys.sort().join(',');
export function safeProviderPlan(plan, allowPostedDemo = false) {
  if (!plan || !/^ns-[0-9a-f]{40}$/.test(plan.actionKey)) return false;
  if (plan.provider==='shopify') {
    const v=plan.variables,o=v?.order,l=o?.lineItems?.[0],m=l?.priceSet?.shopMoney;
    return exact(v,['order','options']) && exact(v.options,['inventoryBehaviour','sendReceipt','sendFulfillmentReceipt']) && v.options.inventoryBehaviour==='BYPASS' && v.options.sendReceipt===false && v.options.sendFulfillmentReceipt===false &&
      exact(o,['currency','test','buyerAcceptsMarketing','taxesIncluded','tags','sourceIdentifier','lineItems']) && o.currency==='GBP' && o.test===true && o.buyerAcceptsMarketing===false && o.taxesIncluded===false && o.sourceIdentifier===plan.actionKey && Array.isArray(o.tags) && o.tags.length===2 && o.tags[0]==='night-scout-test-programme' && o.tags[1]===plan.actionKey &&
      o.lineItems.length===1 && exact(l,['title','quantity','requiresShipping','taxable','priceSet']) && l.title==='Night Scout synthetic non-stock item' && [1,2].includes(l.quantity) && l.requiresShipping===false && l.taxable===false && exact(l.priceSet,['shopMoney']) && exact(m,['amount','currencyCode']) && m.currencyCode==='GBP' && typeof m.amount==='string' && /^\d{1,4}\.\d{2}$/.test(m.amount) && Number(m.amount)*l.quantity<=1000;
  }
  if (plan.provider==='xero') {
    const i=plan.body?.Invoices?.[0],l=i?.LineItems?.[0];
    return exact(plan.headers,['Idempotency-Key']) && plan.headers['Idempotency-Key']===plan.actionKey && exact(plan.body,['Invoices']) && Array.isArray(plan.body.Invoices) && plan.body.Invoices.length===1 && exact(i,['Type','Contact','Date','DueDate','CurrencyCode','Status','LineAmountTypes','InvoiceNumber','Reference','LineItems']) && i.Type==='ACCREC' && (i.Status==='DRAFT' || allowPostedDemo && i.Status==='AUTHORISED') && i.CurrencyCode==='GBP' && i.LineAmountTypes==='NoTax' && i.InvoiceNumber===plan.actionKey && i.Reference==='Night Scout synthetic test programme' && exact(i.Contact,['ContactID']) && /^[0-9a-f-]{36}$/i.test(i.Contact.ContactID) && /^\d{4}-\d{2}-\d{2}$/.test(i.Date) && i.DueDate===i.Date && Array.isArray(i.LineItems) && i.LineItems.length===1 && exact(l,['Description','Quantity','UnitAmount','AccountCode']) && l.Description==='Synthetic test non-stock service' && l.Quantity===1 && Number.isFinite(l.UnitAmount) && l.UnitAmount>=0 && l.UnitAmount<=1000 && /^[A-Za-z0-9_-]{1,20}$/.test(l.AccountCode);
  }
  return false;
}
// Credential values stay in this closure and never enter plans, ledgers or results.
export function createProviderTransport({ provider, target, token, fetchImpl = fetch, timeoutMs = 10000, allowPostedDemo = false }) {
  let verifiedDemo = false;
  if (!['shopify','xero'].includes(provider) || typeof token !== 'string' || !token || timeoutMs < 1 || timeoutMs > 30000) throw new Error('Invalid transport configuration');
  if (provider === 'shopify' ? !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(target) : !/^[0-9a-f-]{36}$/i.test(target)) throw new Error('Invalid exact target');
  const headers = provider === 'shopify' ? { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } : { Authorization: `Bearer ${token}`, 'Xero-tenant-id': target, 'Content-Type': 'application/json', Accept: 'application/json' };
  async function request(url, method, body, extra = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw new Error('PROVIDER_REQUEST_FAILED');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('INVALID_RESPONSE');
      let size = 0; const chunks = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 131072) { await reader.cancel(); throw new Error('RESPONSE_LIMIT'); } chunks.push(value); }
      const joined = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
      return JSON.parse(new TextDecoder().decode(joined));
    } catch { throw new Error('PROVIDER_UNAVAILABLE'); } finally { clearTimeout(timer); }
  }
  const shopifyUrl = `https://${target}/admin/api/2026-07/graphql.json`;
  return Object.freeze({
    async verifyTarget(activation) {
      verifiedDemo=false;
      if (activation.target !== target || activation.provider !== provider || activation.verifiedTestTarget !== true) return false;
      if (provider === 'shopify') {
        const r = await request(shopifyUrl, 'POST', { query: '{ shop { myshopifyDomain currencyCode plan { partnerDevelopment } } }' });
        return r.data?.shop?.myshopifyDomain === target && r.data.shop.currencyCode === 'GBP' && r.data.shop.plan.partnerDevelopment === true;
      }
      const connections = await request('https://api.xero.com/connections', 'GET');
      if (!Array.isArray(connections) || connections.filter(c=>c.tenantId===target && c.tenantType==='ORGANISATION').length !== 1) return false;
      const r = await request('https://api.xero.com/api.xro/2.0/Organisation', 'GET');
      // IsDemoCompany is returned by Xero, not a caller-supplied assertion.
      verifiedDemo = r.Organisations?.length === 1 && r.Organisations[0].IsDemoCompany === true && r.Organisations[0].BaseCurrency === 'GBP';
      return verifiedDemo;
    },
    async write(plan) {
      if (plan.target !== target || plan.provider !== provider) throw new Error('TARGET_MISMATCH');
      if (!safeProviderPlan(plan, allowPostedDemo === true && verifiedDemo)) throw new Error('UNSAFE_WRITE_PLAN');
      if (provider === 'shopify') {
        const r = await request(shopifyUrl, 'POST', { query: 'mutation($order:OrderCreateOrderInput!,$options:OrderCreateOptionsInput){orderCreate(order:$order,options:$options){userErrors{field} order{id test currencyCode tags displayFulfillmentStatus totalPriceSet{shopMoney{amount currencyCode}} transactions{id}}}}', variables: plan.variables });
        if (r.errors || r.data?.orderCreate?.userErrors?.length) throw new Error('WRITE_UNCONFIRMED');
        return { sourceId: r.data?.orderCreate?.order?.id, order: r.data?.orderCreate?.order };
      }
      if (plan.body?.Invoices?.[0]?.Status === 'AUTHORISED' && !(allowPostedDemo === true && verifiedDemo)) throw new Error('POSTED_INVOICES_DISABLED');
      const r = await request('https://api.xero.com/api.xro/2.0/Invoices', 'PUT', plan.body, plan.headers);
      return { sourceId: r.Invoices?.[0]?.InvoiceID, invoice: r.Invoices?.[0] };
    },
    async verifyResult(plan, result) {
      if (provider === 'shopify') {
        const o = result.order;
        const expected = Number(plan.variables.order.lineItems[0].priceSet.shopMoney.amount) * plan.variables.order.lineItems[0].quantity;
        return /^gid:\/\/shopify\/Order\/\d+$/.test(result.sourceId) && o?.test === true && o.currencyCode === 'GBP' && o.tags?.includes(plan.actionKey) && o.displayFulfillmentStatus === 'UNFULFILLED' && Array.isArray(o.transactions) && o.transactions.length === 0 && Number(o.totalPriceSet?.shopMoney?.amount) === expected;
      }
      const i = result.invoice, expected = plan.body.Invoices[0];
      return /^[0-9a-f-]{36}$/i.test(result.sourceId) && i?.Status === expected.Status && i.CurrencyCode === 'GBP' && i.InvoiceNumber === expected.InvoiceNumber && !i.HasValidationErrors && Number(i.Total) === expected.LineItems[0].UnitAmount;
    },
  });
}
