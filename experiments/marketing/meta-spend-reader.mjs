const apiOrigin = 'https://graph.facebook.com';
const safeError = () => new Error('Meta Ads spend read unavailable');
const accountIdPattern = /^\d{5,32}$/;
const versionPattern = /^v\d+\.\d+$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const currencyPattern = /^[A-Z]{3}$/;
const allowedFields = new Set(['account_id', 'date_start', 'date_stop', 'spend']);

function isCalendarDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function currencyExponent(currency) {
  if (!currencyPattern.test(currency)) throw safeError();
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    throw safeError();
  }
}

function decimalToMinorUnits(value, exponent) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) throw safeError();
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > exponent) throw safeError();
  const scale = 10n ** BigInt(exponent);
  const fractionalMinor = fraction.length ? BigInt(fraction.padEnd(exponent, '0')) : 0n;
  const result = BigInt(whole) * scale + fractionalMinor;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw safeError();
  return result.toString();
}

function assertDateRange(from, to) {
  if (!isCalendarDay(from) || !isCalendarDay(to) || from > to) throw safeError();
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  if (!Number.isInteger(days) || days > 93) throw safeError();
}

async function readJson(url, accessToken, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw safeError();
  }
  if (!response?.ok) throw safeError();
  let body;
  try {
    const raw = await readBoundedText(response, 1_000_000);
    body = JSON.parse(raw);
  } catch {
    throw safeError();
  }
  return body;
}

async function readBoundedText(response, maxBytes) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    try { await response.body?.cancel?.(); } catch { /* Preserve the generic provider error. */ }
    throw safeError();
  }
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
        try { await reader.cancel(); } catch { /* Preserve the generic provider error. */ }
        throw safeError();
      }
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch { /* Stream may already be closed. */ }
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
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { throw safeError(); }
}

function metaUrl(version, path, params = {}) {
  const url = new URL(`/${version}/${path}`, apiOrigin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

function validateAccountMetadata(body, accountId) {
  if (!body || (body.id !== accountId && body.id !== `act_${accountId}`)
    || typeof body.currency !== 'string' || !currencyPattern.test(body.currency)
    || typeof body.timezone_name !== 'string' || body.timezone_name.length < 1 || body.timezone_name.length > 128) {
    throw safeError();
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: body.timezone_name });
  } catch {
    throw safeError();
  }
  return Object.freeze({ currency: body.currency, timeZone: body.timezone_name });
}

function parseSpendRow(row, { accountId, currency, exponent, from, to }) {
  if (!row || Object.keys(row).some((key) => !allowedFields.has(key))
    || (row.account_id !== accountId && row.account_id !== `act_${accountId}`)
    || !isCalendarDay(row.date_start) || row.date_start !== row.date_stop
    || row.date_start < from || row.date_start > to) {
    throw safeError();
  }
  return Object.freeze({
    provider: 'meta_ads',
    accountId,
    date: row.date_start,
    currency,
    spendMinor: decimalToMinorUnits(row.spend, exponent),
  });
}

function nextPageUrl(value, { version, path }) {
  if (typeof value !== 'string' || value.length > 16_384) throw safeError();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw safeError();
  }
  if (url.origin !== apiOrigin || url.pathname !== `/${version}/${path}`
    || url.username || url.password || url.hash) throw safeError();
  // Do not allow a provider-supplied continuation URL to move the token into a URL.
  url.searchParams.delete('access_token');
  return url;
}

function parseAccountRow(row) {
  if (!row || Object.keys(row).some((key) => !new Set(['id', 'account_id', 'currency', 'timezone_name']).has(key))
    || typeof row.id !== 'string' || typeof row.currency !== 'string' || !currencyPattern.test(row.currency)
    || typeof row.timezone_name !== 'string' || row.timezone_name.length < 1 || row.timezone_name.length > 128) {
    throw safeError();
  }
  const idFromNode = row.id.startsWith('act_') ? row.id.slice(4) : row.id;
  const accountId = row.account_id ?? idFromNode;
  if (typeof accountId !== 'string' || !accountIdPattern.test(accountId)
    || idFromNode !== accountId) throw safeError();
  try {
    new Intl.DateTimeFormat('en', { timeZone: row.timezone_name });
  } catch {
    throw safeError();
  }
  return Object.freeze({ accountId, currency: row.currency, timeZone: row.timezone_name });
}

/** Lists only ad account IDs and their reporting currency/timezone; names and assets are not fetched. */
export async function discoverMetaAdAccounts({ accessToken, apiVersion, fetchImpl = fetch }) {
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof apiVersion !== 'string' || !versionPattern.test(apiVersion)
    || typeof fetchImpl !== 'function') throw safeError();
  const path = 'me/adaccounts';
  let page = metaUrl(apiVersion, path, {
    fields: 'id,account_id,currency,timezone_name',
    limit: '200',
  });
  const accounts = [];
  const seen = new Set();
  let pagesRead = 0;
  while (page) {
    if (++pagesRead > 100) throw safeError();
    const body = await readJson(page, accessToken, fetchImpl);
    if (!body || !Array.isArray(body.data) || body.data.length > 5_000 || accounts.length + body.data.length > 5_000) throw safeError();
    for (const row of body.data) {
      const account = parseAccountRow(row);
      if (seen.has(account.accountId)) throw safeError();
      seen.add(account.accountId);
      accounts.push(account);
    }
    page = body.paging?.next ? nextPageUrl(body.paging.next, { version: apiVersion, path }) : null;
  }
  accounts.sort((a, b) => a.accountId.localeCompare(b.accountId));
  return Object.freeze({ accounts: Object.freeze(accounts), pagesRead });
}

/**
 * Reads only daily account-level spend from Meta Ads Insights.
 * The caller owns OAuth, token storage, account consent and persistence.
 * Missing dates remain absent; callers must not interpret them as zero.
 */
export async function readMetaDailySpend({
  accessToken,
  accountId,
  from,
  to,
  apiVersion,
  fetchImpl = fetch,
}) {
  if (typeof accessToken !== 'string' || accessToken.length < 16 || accessToken.length > 16_384
    || typeof accountId !== 'string' || !accountIdPattern.test(accountId)
    || typeof apiVersion !== 'string' || !versionPattern.test(apiVersion)
    || typeof fetchImpl !== 'function') throw safeError();
  assertDateRange(from, to);

  const metadataBody = await readJson(metaUrl(apiVersion, `act_${accountId}`, {
    fields: 'id,currency,timezone_name',
  }), accessToken, fetchImpl);
  const metadata = validateAccountMetadata(metadataBody, accountId);
  const exponent = currencyExponent(metadata.currency);
  const range = JSON.stringify({ since: from, until: to });
  let page = metaUrl(apiVersion, `act_${accountId}/insights`, {
    level: 'account',
    time_increment: '1',
    time_range: range,
    fields: 'account_id,date_start,date_stop,spend',
    limit: '500',
  });
  const rows = [];
  const seenDates = new Set();
  let pagesRead = 0;

  while (page) {
    if (++pagesRead > 100) throw safeError();
    const body = await readJson(page, accessToken, fetchImpl);
    if (!body || !Array.isArray(body.data) || body.data.length > 5_000 || rows.length + body.data.length > 93) throw safeError();
    for (const row of body.data) {
      const normalized = parseSpendRow(row, { accountId, currency: metadata.currency, exponent, from, to });
      if (seenDates.has(normalized.date)) throw safeError();
      seenDates.add(normalized.date);
      rows.push(normalized);
    }
    page = body.paging?.next
      ? nextPageUrl(body.paging.next, { version: apiVersion, path: `act_${accountId}/insights` })
      : null;
  }

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
    provider: 'meta_ads',
    accountId,
    currency: metadata.currency,
    timeZone: metadata.timeZone,
    requestedFrom: from,
    requestedTo: to,
    pagesRead,
    rows: Object.freeze(rows),
    missingDates: Object.freeze(missingDates),
    retrievedAt: new Date().toISOString(),
  });
}
