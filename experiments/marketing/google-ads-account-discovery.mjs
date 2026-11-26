const apiOrigin = 'https://googleads.googleapis.com';
const safeError = () => new Error('Google Ads account discovery unavailable');
const customerIdPattern = /^\d{10}$/;
const apiVersion = 'v26';
const maxInt64 = 9_223_372_036_854_775_807n;

function validateCustomerId(value) {
  if (typeof value !== 'string' || !customerIdPattern.test(value)) throw safeError();
  return value;
}

function parseResourceName(value) {
  if (typeof value !== 'string' || !/^customers\/\d{10}$/.test(value)) throw safeError();
  return value.slice('customers/'.length);
}

function validatePageToken(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 16_384 || /[\r\n]/.test(value)) throw safeError();
  return value;
}

async function readBoundedJson(response, maxBytes) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) throw safeError();
  const reader = response.body?.getReader?.();
  if (!reader) throw safeError();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw safeError();
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw safeError();
      }
      chunks.push(value);
    }
  } catch {
    throw safeError();
  } finally {
    try { reader.releaseLock(); } catch { /* Stream may already be closed. */ }
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw safeError();
  }
}

async function requestJson(url, { accessToken, loginCustomerId = null, method = 'GET', body, fetchImpl }) {
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof fetchImpl !== 'function'
    || (loginCustomerId !== null && !customerIdPattern.test(loginCustomerId))) throw safeError();
  const headers = { authorization: `Bearer ${accessToken}`, accept: 'application/json' };
  const options = {
    method,
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  };
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch {
    throw safeError();
  }
  if (!response?.ok) throw safeError();
  return readBoundedJson(response, method === 'GET' ? 1_000_000 : 2_000_000);
}

function customerEndpoint(customerId, method) {
  return new URL(`/${apiVersion}/customers/${customerId}/googleAds:${method}`, apiOrigin);
}

async function searchCustomer({ customerId, accessToken, loginCustomerId = null, query, fetchImpl }) {
  let pageToken = null;
  let pagesRead = 0;
  const results = [];
  do {
    if (++pagesRead > 25) throw safeError();
    const body = { query };
    if (pageToken) body.pageToken = pageToken;
    const response = await requestJson(customerEndpoint(customerId, 'search'), {
      accessToken,
      loginCustomerId,
      method: 'POST',
      body,
      fetchImpl,
    });
    if (!response || !Array.isArray(response.results) || results.length + response.results.length > 5_000) throw safeError();
    results.push(...response.results);
    pageToken = validatePageToken(response.nextPageToken);
  } while (pageToken);
  return Object.freeze({ results: Object.freeze(results), pagesRead });
}

/**
 * Lists only customer IDs the OAuth user can access directly. It does not
 * include client accounts accessible only through a manager hierarchy.
 */
export async function listGoogleAdsDirectCustomerIds({ accessToken, fetchImpl = fetch }) {
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof fetchImpl !== 'function') throw safeError();
  const response = await requestJson(new URL(`/${apiVersion}/customers:listAccessibleCustomers`, apiOrigin), {
    accessToken,
    fetchImpl,
  });
  if (!response || !Array.isArray(response.resourceNames) || response.resourceNames.length > 1_000) throw safeError();
  const customerIds = response.resourceNames.map(parseResourceName);
  if (new Set(customerIds).size !== customerIds.length) throw safeError();
  customerIds.sort();
  return Object.freeze({ customerIds: Object.freeze(customerIds) });
}

/**
 * Inspects a directly accessible customer without using a manager header.
 * Returns only its ID and whether Google marks it as a manager account.
 */
export async function inspectGoogleAdsDirectCustomer({
  accessToken,
  customerId,
  directlyAccessibleCustomerIds,
  fetchImpl = fetch,
}) {
  validateCustomerId(customerId);
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof fetchImpl !== 'function' || !Array.isArray(directlyAccessibleCustomerIds)
    || !directlyAccessibleCustomerIds.includes(customerId)) throw safeError();
  const metadata = await searchCustomer({
    customerId,
    accessToken,
    query: 'SELECT customer.id, customer.manager FROM customer',
    fetchImpl,
  });
  if (metadata.results.length !== 1) throw safeError();
  const customer = metadata.results[0]?.customer;
  if (!customer || String(customer.id) !== customerId || typeof customer.manager !== 'boolean') throw safeError();
  return Object.freeze({ customerId, isManager: customer.manager });
}

/** Verifies that a directly accessible customer is an advertiser, not a manager. */
export async function verifyGoogleAdsDirectAdvertiser({
  accessToken,
  customerId,
  directlyAccessibleCustomerIds,
  fetchImpl = fetch,
}) {
  const inspected = await inspectGoogleAdsDirectCustomer({
    accessToken,
    customerId,
    directlyAccessibleCustomerIds,
    fetchImpl,
  });
  if (inspected.isManager) throw safeError();
  return Object.freeze({ customerId, relationship: 'direct' });
}

/**
 * Lists active, non-manager advertiser clients in a manager hierarchy. The
 * manager ID must first be confirmed against listGoogleAdsDirectCustomerIds
 * and bound to the same stored OAuth connection by the server-side caller.
 * No names, currency, or unrelated customer data are requested.
 */
export async function listGoogleAdsManagerAdvertisers({
  accessToken,
  managerCustomerId,
  fetchImpl = fetch,
}) {
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof fetchImpl !== 'function') throw safeError();
  validateCustomerId(managerCustomerId);

  const metadata = await searchCustomer({
    customerId: managerCustomerId,
    accessToken,
    loginCustomerId: managerCustomerId,
    query: 'SELECT customer.id, customer.manager FROM customer',
    fetchImpl,
  });
  if (metadata.results.length !== 1) throw safeError();
  const manager = metadata.results[0]?.customer;
  if (!manager || String(manager.id) !== managerCustomerId || manager.manager !== true) throw safeError();

  const hierarchy = await searchCustomer({
    customerId: managerCustomerId,
    accessToken,
    loginCustomerId: managerCustomerId,
    query: "SELECT customer_client.client_customer, customer_client.level, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.status = 'ENABLED' ORDER BY customer_client.level ASC",
    fetchImpl,
  });
  const advertisers = [];
  const seen = new Set();
  for (const row of hierarchy.results) {
    if (!row || Object.keys(row).some((key) => key !== 'customerClient')) throw safeError();
    const client = row.customerClient;
    if (!client || Object.keys(client).some((key) => !new Set(['clientCustomer', 'level', 'manager', 'status']).has(key))) throw safeError();
    const customerId = parseResourceName(client.clientCustomer);
    if (client.status !== 'ENABLED' || typeof client.manager !== 'boolean'
      || typeof client.level !== 'string' || !/^\d+$/.test(client.level)
      || client.level.length > 19 || BigInt(client.level) > maxInt64) throw safeError();
    // The hierarchy query includes its root and may include nested managers.
    if (customerId === managerCustomerId || client.manager) continue;
    if (seen.has(customerId)) throw safeError();
    seen.add(customerId);
    advertisers.push(Object.freeze({
      customerId,
      loginCustomerId: managerCustomerId,
      relationship: 'manager_client',
      hierarchyLevel: Number(client.level),
    }));
  }
  advertisers.sort((a, b) => a.customerId.localeCompare(b.customerId));
  return Object.freeze({
    managerCustomerId,
    advertisers: Object.freeze(advertisers),
    pagesRead: metadata.pagesRead + hierarchy.pagesRead,
  });
}

/**
 * Reads only the selected customer's identity, reporting currency and IANA
 * timezone. Customer and optional manager IDs must come from trusted server
 * connection/selection state, never directly from browser request fields.
 */
export async function readGoogleAdsCustomerMetadata({
  accessToken,
  customerId,
  loginCustomerId = null,
  fetchImpl = fetch,
}) {
  validateCustomerId(customerId);
  if (loginCustomerId !== null) validateCustomerId(loginCustomerId);
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof fetchImpl !== 'function') throw safeError();
  const response = await searchCustomer({
    customerId,
    accessToken,
    loginCustomerId,
    query: 'SELECT customer.id, customer.currency_code, customer.time_zone FROM customer',
    fetchImpl,
  });
  if (response.results.length !== 1) throw safeError();
  const result = response.results[0];
  if (!result || Object.keys(result).some((key) => key !== 'customer')) throw safeError();
  const customer = result.customer;
  if (!customer || Object.keys(customer).some((key) => !new Set(['id', 'currencyCode', 'timeZone']).has(key))
    || String(customer.id) !== customerId
    || typeof customer.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(customer.currencyCode)
    || typeof customer.timeZone !== 'string' || customer.timeZone.length < 1 || customer.timeZone.length > 128) {
    throw safeError();
  }
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: customer.currencyCode });
    new Intl.DateTimeFormat('en', { timeZone: customer.timeZone });
  } catch {
    throw safeError();
  }
  return Object.freeze({
    customerId,
    currency: customer.currencyCode,
    timeZone: customer.timeZone,
  });
}

/**
 * Converts a server-owned verified discovery result into an immutable stored
 * selection. Never call this with IDs supplied directly by a browser request.
 */
export function bindGoogleAdsAccountSelection({
  discoveredDirectCustomerIds,
  discoveredDirectAdvertiserCustomerIds,
  discoveredManagerResults,
  customerId,
  loginCustomerId = null,
}) {
  validateCustomerId(customerId);
  if (loginCustomerId === null) {
    if (!Array.isArray(discoveredDirectCustomerIds) || !discoveredDirectCustomerIds.includes(customerId)
      || !Array.isArray(discoveredDirectAdvertiserCustomerIds)
      || !discoveredDirectAdvertiserCustomerIds.includes(customerId)) throw safeError();
    return Object.freeze({ customerId, loginCustomerId: null });
  }
  validateCustomerId(loginCustomerId);
  if (!Array.isArray(discoveredDirectCustomerIds) || !discoveredDirectCustomerIds.includes(loginCustomerId)
    || !Array.isArray(discoveredManagerResults)
    || !discoveredManagerResults.some((result) => result?.managerCustomerId === loginCustomerId
      && Array.isArray(result.advertisers)
      && result.advertisers.some((advertiser) => advertiser?.customerId === customerId
        && advertiser?.loginCustomerId === loginCustomerId))) throw safeError();
  return Object.freeze({ customerId, loginCustomerId });
}
