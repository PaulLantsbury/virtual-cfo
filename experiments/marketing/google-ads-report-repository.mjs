import {isGoogleAdsReportTimestamp} from './google-ads-report-timestamp.mjs';
const fail = () => new Error('Google Ads report unavailable');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const customerIdPattern = /^\d{10}$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const currencyPattern = /^[A-Z]{3}$/;
const maxSpendMicros = 9_223_372_036_854_775_807n;
const coverageStates = new Set(['provider_row', 'no_row', 'partial', 'failed']);
const runStatuses = new Set(['complete', 'partial']);

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function validDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function dateValue(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString().slice(0, 10);
  throw fail();
}

function timestamp(value) {
  if (typeof value === 'string') {
    if (!isGoogleAdsReportTimestamp(value)) throw fail();
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.valueOf())) throw fail();
    return parsed.toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString();
  throw fail();
}

function expectedDates(from, to) {
  if (!validDay(from) || !validDay(to) || from > to) throw fail();
  const count = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 93) throw fail();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${from}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function validateAccountFields(row) {
  const customerId = row.customer_id;
  const loginCustomerId = row.login_customer_id;
  const currency = row.currency;
  const timeZone = row.timezone_name;
  const allNull = customerId === null && loginCustomerId === null && currency === null && timeZone === null;
  if (allNull) return null;
  if (!customerIdPattern.test(customerId ?? '')
    || (loginCustomerId !== null && !customerIdPattern.test(loginCustomerId ?? ''))
    || !currencyPattern.test(currency ?? '')
    || typeof timeZone !== 'string' || timeZone.length < 1 || timeZone.length > 128) throw fail();
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency });
    new Intl.DateTimeFormat('en', { timeZone });
  } catch { throw fail(); }
  return Object.freeze({ customerId, loginCustomerId, currency, timeZone });
}

function mapDay(row, expectedDate) {
  if (dateValue(row.spend_date) !== expectedDate) throw fail();
  if (row.coverage_state === null) {
    if (row.spend_micros !== null || row.observed_at !== null || row.run_id !== null
      || row.run_status !== null || row.run_started_at !== null) throw fail();
    return Object.freeze({
      date: expectedDate,
      coverageState: 'not_collected',
      spendMicros: null,
      observedAt: null,
      runId: null,
      runStatus: null,
      runStartedAt: null,
    });
  }

  if (!coverageStates.has(row.coverage_state)
    || (row.run_status !== 'complete' && row.run_status !== 'partial')
    || typeof row.run_id !== 'string' || !uuidPattern.test(row.run_id)) throw fail();
  const observedAt = timestamp(row.observed_at);
  const runStartedAt = timestamp(row.run_started_at);
  let spendMicros = null;
  if (row.coverage_state === 'provider_row') {
    if (typeof row.spend_micros !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(row.spend_micros)) throw fail();
    const spend = BigInt(row.spend_micros);
    if (spend > maxSpendMicros) throw fail();
    spendMicros = spend.toString();
  } else if (row.spend_micros !== null) throw fail();

  return Object.freeze({
    date: expectedDate,
    coverageState: row.coverage_state,
    spendMicros,
    observedAt,
    runId: row.run_id,
    runStatus: row.run_status,
    runStartedAt,
  });
}

/**
 * Adapts the fixed, report-only Google Ads RPC into the authenticated route's
 * spend contract. The RPC enforces store membership and account selection;
 * this adapter adds strict row/date validation and never converts micros to a
 * floating-point number.
 */
export function createGoogleAdsSpendReportRepository({ rpc, now = () => new Date() }) {
  if (!rpc || typeof rpc.call !== 'function' || typeof now !== 'function') throw fail();

  return Object.freeze({
    async readSpend(identity, { storeId, from, to } = {}) {
      if (!plain(identity) || !uuidPattern.test(identity.userId ?? '')
        || !uuidPattern.test(storeId ?? '')) throw fail();
      const dates = expectedDates(from, to);
      const instant = now();
      if (!(instant instanceof Date) || !Number.isFinite(instant.valueOf())) throw fail();

      let rows;
      try {
        rows = await rpc.call('google_ads_v1.worker_read_daily_spend', [
          identity.userId,
          storeId,
          from,
          to,
          instant.toISOString(),
        ]);
      } catch { throw fail(); }
      if (!Array.isArray(rows) || rows.length !== dates.length) throw fail();

      let account = null;
      const days = rows.map((row, index) => {
        if (!plain(row)) throw fail();
        const selected = validateAccountFields(row);
        if (index === 0) account = selected;
        else if (JSON.stringify(selected) !== JSON.stringify(account)) throw fail();
        return mapDay(row, dates[index]);
      });

      if (account === null) {
        if (days.some((day) => day.coverageState !== 'not_collected')) throw fail();
        return Object.freeze({ status: 'not_connected', storeId, from, to, account: null, days: Object.freeze([]) });
      }

      return Object.freeze({
        status: 'available',
        storeId,
        from,
        to,
        account: Object.freeze({
          customerId: account.customerId,
          currency: account.currency,
          timeZone: account.timeZone,
        }),
        days: Object.freeze(days),
      });
    },
  });
}
