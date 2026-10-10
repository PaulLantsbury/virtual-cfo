import {createShopifyReader} from './client.mjs';
import {API_VERSION} from './queries.mjs';

const REQUIRED_SCOPES = ['read_orders', 'read_all_orders'];
const fail = message => { throw new Error(message); };

/** Server-only, read-only context check. No order collection, persistence or
 * financial certification. The caller supplies an authorised private resolver.
 * Error messages and the returned allowlisted summary never include raw payloads.
 */
export async function verifyShopifyConnection({connection, resolveCredential,
  fetchImpl = globalThis.fetch, sleep, signal, timeoutMs = 60000} = {}) {
  if (!connection || !/^gid:\/\/shopify\/Shop\/[0-9]+$/.test(connection.shopId) ||
      !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(connection.domain) ||
      !/^[A-Z]{3}$/.test(connection.currency) || typeof connection.timezone !== 'string' ||
      typeof resolveCredential !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    fail('Invalid Shopify verification configuration');
  }
  try { new Intl.DateTimeFormat('en-GB', {timeZone: connection.timezone}).format(); }
  catch { fail('Invalid Shopify verification configuration'); }
  const expected = Object.freeze({shopId: connection.shopId, domain: connection.domain,
    currency: connection.currency, timezone: connection.timezone});
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, {once: true});
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(new Error('Shopify verification cancelled or timed out'));
    controller.signal.addEventListener('abort', onAbort, {once: true});
    if (controller.signal.aborted) onAbort();
  });
  try {
    return await Promise.race([aborted, (async () => {
      if (controller.signal.aborted) return await aborted;
      let token;
      try { token = await resolveCredential({shopId: expected.shopId, domain: expected.domain}, {signal: controller.signal}); }
      catch { fail('Shopify credential resolution failed'); }
      if (controller.signal.aborted) return await aborted;
      let data;
      try {
        const read = createShopifyReader({domain: expected.domain, accessToken: token, fetchImpl, ...(sleep ? {sleep} : {})});
        data = await read('context', {}, controller.signal);
      } catch { fail('Shopify context request failed; check credentials, permissions and API compatibility'); }
      if (controller.signal.aborted) return await aborted;
      const shop = data?.shop;
      if (shop?.id !== expected.shopId || shop?.myshopifyDomain !== expected.domain) fail('Shopify identity does not match configured store');
      if (shop.currencyCode !== expected.currency || shop.ianaTimezone !== expected.timezone) fail('Shopify reporting settings do not match configured store');
      const scopes = data?.currentAppInstallation?.accessScopes;
      if (!Array.isArray(scopes) || !REQUIRED_SCOPES.every(required => scopes.some(scope => scope?.handle === required))) {
        fail('Shopify full order-history read permissions are missing');
      }
      return {status: 'context_verified', apiVersion: API_VERSION, settings: {...expected},
        verifiedRequiredScopes: [...REQUIRED_SCOPES], ordersCollected: false,
        dataImported: false, sourceReconciled: false, coverageCertified: false};
    })()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
