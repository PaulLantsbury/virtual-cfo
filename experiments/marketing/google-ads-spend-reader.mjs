const apiOrigin = 'https://googleads.googleapis.com';
const safeError = () => new Error('Google Ads spend read unavailable');
const customerIdPattern = /^\d{10}$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const currencyPattern = /^[A-Z]{3}$/;
const supportedApiVersions = new Set(['v26']);
const maxInt64 = 9_223_372_036_854_775_807n;

function isCalendarDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function assertDateRange(from, to) {
  if (!isCalendarDay(from) || !isCalendarDay(to) || from > to) throw safeError();
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  if (!Number.isInteger(days) || days > 93) throw safeError();
  return days;
}

function validateCurrency(value) {
  if (typeof value !== 'string' || !currencyPattern.test(value)) throw safeError();
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: value });
  } catch {
    throw safeError();
  }
  return value;
}

function validateTimeZone(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) throw safeError();
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
  } catch {
    throw safeError();
  }
  return value;
}

function validateCustomerId(value) {
  if (typeof value !== 'string' || !customerIdPattern.test(value)) throw safeError();
  return value;
}

function validatePageToken(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 16_384 || /[\r\n]/.test(value)) throw safeError();
  return value;
}

async function postJson(url, { accessToken, loginCustomerId, body, fetchImpl }) {
  let response;
  try {
    const headers = {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
    response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw safeError();
  }
  if (!response?.ok) throw safeError();
  return readBoundedJson(response, 2_000_000);
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

function customerEndpoint(apiVersion, customerId, method) {
  return new URL(`/${apiVersion}/customers/${customerId}/googleAds:${method}`, apiOrigin);
}

function parseCustomerResourceName(value) {
  if (typeof value !== 'string' || !/^customers\/\d{10}$/.test(value)) throw safeError();
  return value.slice('customers/'.length);
}

/**
 * Lists only customer IDs directly accessible to the authorized identity.
 * It does not enumerate client accounts under a manager account.
 */
export async function discoverGoogleAdsCustomers({ accessToken, apiVersion = 'v26', fetchImpl = fetch }) {
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof apiVersion !== 'string' || !supportedApiVersions.has(apiVersion)
    || typeof fetchImpl !== 'function') throw safeError();

  let response;
  try {
    response = await fetchImpl(new URL(`/${apiVersion}/customers:listAccessibleCustomers`, apiOrigin), {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw safeError();
  }
  if (!response?.ok) throw safeError();
  const body = await readBoundedJson(response, 1_000_000);
  if (!body || !Array.isArray(body.resourceNames) || body.resourceNames.length > 5_000) throw safeError();
  const customers = body.resourceNames.map(parseCustomerResourceName);
  if (new Set(customers).size !== customers.length) throw safeError();
  customers.sort();
  return Object.freeze({ customers: Object.freeze(customers) });
}

/**
 * Reads daily customer-level spend only. The caller owns OAuth, account consent,
 * refresh-token storage and persistence. Missing dates are returned separately,
 * never converted to zero. IDs are server-selected; do not pass browser IDs here.
 */
export async function readGoogleAdsDailySpend({
  accessToken,
  customerId,
  loginCustomerId = null,
  from,
  to,
  apiVersion = 'v26',
  fetchImpl = fetch,
}) {
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof apiVersion !== 'string' || !supportedApiVersions.has(apiVersion)
    || typeof fetchImpl !== 'function') throw safeError();
  validateCustomerId(customerId);
  if (loginCustomerId !== null) validateCustomerId(loginCustomerId);
  const requestedDays = assertDateRange(from, to);

  const metadataQuery = 'SELECT customer.id, customer.currency_code, customer.time_zone FROM customer';
  const metadataBody = await postJson(customerEndpoint(apiVersion, customerId, 'search'), {
    accessToken,
    loginCustomerId,
    body: { query: metadataQuery },
    fetchImpl,
  });
  if (!metadataBody || !Array.isArray(metadataBody.results) || metadataBody.results.length !== 1) throw safeError();
  const metadataResult = metadataBody.results[0]?.customer;
  if (!metadataResult || String(metadataResult.id) !== customerId) throw safeError();
  const currency = validateCurrency(metadataResult.currencyCode);
  const timeZone = validateTimeZone(metadataResult.timeZone);

  const query = [
    'SELECT customer.id, customer.currency_code, customer.time_zone, segments.date, metrics.cost_micros',
    'FROM customer',
    `WHERE segments.date BETWEEN '${from}' AND '${to}'`,
    'ORDER BY segments.date ASC',
  ].join(' ');
  let pageToken = null;
  let pagesRead = 0;
  const rows = [];
  const seenDates = new Set();

  do {
    if (++pagesRead > 20) throw safeError();
    const requestBody = { query };
    if (pageToken) requestBody.pageToken = pageToken;
    const body = await postJson(customerEndpoint(apiVersion, customerId, 'search'), {
      accessToken,
      loginCustomerId,
      body: requestBody,
      fetchImpl,
    });
    if (!body || !Array.isArray(body.results) || rows.length + body.results.length > requestedDays) throw safeError();
    for (const result of body.results) {
      if (!result || Object.keys(result).some((key) => !new Set(['customer', 'segments', 'metrics']).has(key))) throw safeError();
      const resultCustomer = result.customer;
      const date = result.segments?.date;
      const costMicros = result.metrics?.costMicros;
      if (!resultCustomer || String(resultCustomer.id) !== customerId
        || resultCustomer.currencyCode !== currency || resultCustomer.timeZone !== timeZone
        || !isCalendarDay(date) || date < from || date > to
        || typeof costMicros !== 'string' || costMicros.length > 19 || !/^\d+$/.test(costMicros) || BigInt(costMicros) > maxInt64
        || seenDates.has(date)) throw safeError();
      seenDates.add(date);
      rows.push(Object.freeze({
        provider: 'google_ads',
        customerId,
        date,
        currency,
        timeZone,
        spendMicros: BigInt(costMicros).toString(),
      }));
    }
    pageToken = validatePageToken(body.nextPageToken);
  } while (pageToken);

  rows.sort((a, b) => a.date.localeCompare(b.date));
  const returnedDates = new Set(rows.map((row) => row.date));
  const missingDates = [];
  for (let day = from; day <= to;) {
    if (!returnedDates.has(day)) missingDates.push(day);
    const date = new Date(`${day}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    day = date.toISOString().slice(0, 10);
  }

  return Object.freeze({
    provider: 'google_ads',
    customerId,
    loginCustomerId,
    currency,
    timeZone,
    requestedFrom: from,
    requestedTo: to,
    pagesRead,
    rows: Object.freeze(rows),
    missingDates: Object.freeze(missingDates),
    retrievedAt: new Date().toISOString(),
  });
}
