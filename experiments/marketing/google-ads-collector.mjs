import { readGoogleAdsDailySpend } from './google-ads-spend-reader.mjs';

const unavailable = () => new Error('Google Ads collection unavailable');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const customer = /^\d{10}$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const idempotency = /^[A-Za-z0-9._:-]{16,200}$/;
const failures = new Set(['token_expired', 'access_revoked', 'provider_unavailable', 'invalid_response', 'scope_missing']);

function validDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function addDays(value, count) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function inclusiveDays(from, to) {
  return (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1;
}

function accountLocalDay(instant, timeZone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(instant).map((part) => [part.type, part.value]));
    const result = `${parts.year}-${parts.month}-${parts.day}`;
    if (!validDay(result)) throw unavailable();
    return result;
  } catch { throw unavailable(); }
}

function validateAccount(value, requested) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.storeId !== requested.storeId || value.connectionId !== requested.connectionId
    || value.customerId !== requested.customerId || value.active !== true
    || !customer.test(value.customerId ?? '')
    || (value.loginCustomerId !== null && !customer.test(value.loginCustomerId ?? ''))
    || value.loginCustomerId === value.customerId
    || !/^[A-Z]{3}$/.test(value.currency ?? '')
    || typeof value.timeZone !== 'string' || value.timeZone.length < 1 || value.timeZone.length > 128) throw unavailable();
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { throw unavailable(); }
  return value;
}

function buildCoverage(result, account, from, to) {
  if (!Array.isArray(result.rows) || !Array.isArray(result.missingDates)
    || result.rows.length > 14 || result.missingDates.length > 14
    || !Number.isInteger(result.pagesRead) || result.pagesRead < 1 || result.pagesRead > 20
    || typeof result.retrievedAt !== 'string' || !Number.isFinite(Date.parse(result.retrievedAt))) throw unavailable();
  const byDate = new Map();
  for (const row of result.rows) {
    if (!row || row.provider !== 'google_ads' || row.customerId !== account.customerId
      || (row.loginCustomerId ?? null) !== (account.loginCustomerId ?? null)
      || row.currency !== account.currency || row.timeZone !== account.timeZone
      || !validDay(row.date) || row.date < from || row.date > to
      || typeof row.spendMicros !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(row.spendMicros)
      || BigInt(row.spendMicros) > 9_223_372_036_854_775_807n || byDate.has(row.date)) throw unavailable();
    byDate.set(row.date, row.spendMicros);
  }
  const missing = new Set(result.missingDates);
  if (missing.size !== result.missingDates.length
    || [...missing].some((date) => !validDay(date) || date < from || date > to)
    || [...byDate.keys()].some((date) => missing.has(date))) throw unavailable();
  const coverage = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (byDate.has(date)) coverage.push(Object.freeze({ date, state: 'provider_row', spendMicros: byDate.get(date) }));
    else if (missing.has(date)) coverage.push(Object.freeze({ date, state: 'no_row', spendMicros: null }));
    else throw unavailable();
  }
  return Object.freeze(coverage);
}

/** Server-only one-account Google spend collection. There is no campaign or
 * conversion path. The repository must expose only the fixed worker RPCs. */
export function createGoogleAdsSpendCollector({ credentialProvider, repository, reader = readGoogleAdsDailySpend, apiVersion = 'v26', now = () => new Date() }) {
  if (!credentialProvider || typeof credentialProvider.getSelectedAccount !== 'function'
    || typeof credentialProvider.getAccessToken !== 'function'
    || !repository || typeof repository.beginRun !== 'function' || typeof repository.completeRun !== 'function'
    || typeof repository.failRun !== 'function' || typeof reader !== 'function' || typeof now !== 'function'
    || !/^v\d+$/.test(apiVersion)) throw unavailable();

  return Object.freeze({
    async collect(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || !uuid.test(input.storeId ?? '') || !uuid.test(input.connectionId ?? '')
        || !customer.test(input.customerId ?? '') || !idempotency.test(input.idempotencyKey ?? '')
        || !validDay(input.from) || !validDay(input.to) || input.from > input.to
        || inclusiveDays(input.from, input.to) > 14) throw unavailable();
      let run;
      let failure = 'provider_unavailable';
      let token;
      try {
        const selected = validateAccount(await credentialProvider.getSelectedAccount(Object.freeze({
          storeId: input.storeId, connectionId: input.connectionId, customerId: input.customerId,
        })), input);
        const started = now();
        if (!(started instanceof Date) || !Number.isFinite(started.valueOf())) throw unavailable();
        const lastCompleted = addDays(accountLocalDay(started, selected.timeZone), -1);
        const effectiveTo = input.to < lastCompleted ? input.to : lastCompleted;
        if (input.from > effectiveTo || inclusiveDays(input.from, effectiveTo) > 14) throw unavailable();
        run = await repository.beginRun(Object.freeze({
          idempotencyKey: input.idempotencyKey, storeId: input.storeId, connectionId: input.connectionId,
          customerId: input.customerId, requestedFrom: input.from, requestedTo: effectiveTo,
          currency: selected.currency, timeZone: selected.timeZone, apiVersion, startedAt: started.toISOString(),
        }));
        if (!run || typeof run.runId !== 'string' || !uuid.test(run.runId)) throw unavailable();
        if (run.alreadyComplete) return Object.freeze({ status: 'already_collected', runId: run.runId, from: input.from, to: effectiveTo });
        if (run.alreadyRunning) return Object.freeze({ status: 'already_running', runId: run.runId, from: input.from, to: effectiveTo });
        if (run.claimed !== true) throw unavailable();

        const tokenResult = await credentialProvider.getAccessToken(Object.freeze({
          storeId: input.storeId, connectionId: input.connectionId, customerId: input.customerId,
        }));
        if (!tokenResult || typeof tokenResult.accessToken !== 'string' || tokenResult.accessToken.length < 16
          || tokenResult.accessToken.length > 16_384 || typeof tokenResult.expiresAt !== 'string'
          || !Number.isFinite(Date.parse(tokenResult.expiresAt))) throw unavailable();
        token = tokenResult.accessToken;
        if (Date.parse(tokenResult.expiresAt) <= started.valueOf()) { failure = 'token_expired'; throw unavailable(); }

        const result = await reader({
          accessToken: token, customerId: input.customerId, loginCustomerId: selected.loginCustomerId,
          from: input.from, to: effectiveTo, apiVersion,
        });
        if (!result || result.provider !== 'google_ads' || result.customerId !== input.customerId
          || (result.loginCustomerId ?? null) !== (selected.loginCustomerId ?? null)
          || result.currency !== selected.currency || result.timeZone !== selected.timeZone
          || result.requestedFrom !== input.from || result.requestedTo !== effectiveTo) {
          failure = 'invalid_response'; throw unavailable();
        }
        const coverage = buildCoverage(result, selected, input.from, effectiveTo);
        const status = coverage.some((item) => item.state !== 'provider_row') ? 'partial' : 'complete';
        await repository.completeRun(Object.freeze({
          runId: run.runId, idempotencyKey: input.idempotencyKey, status,
          requestedFrom: input.from, requestedTo: effectiveTo, observedAt: result.retrievedAt,
          pagesRead: result.pagesRead,
          source: Object.freeze({
            provider: 'google_ads', customerId: input.customerId,
            loginCustomerId: selected.loginCustomerId ?? null, storeId: input.storeId,
            connectionId: input.connectionId, currency: selected.currency,
            timeZone: selected.timeZone, apiVersion,
          }),
          coverage,
        }));
        return Object.freeze({ status, runId: run.runId, from: input.from, to: effectiveTo, observedAt: result.retrievedAt, coverage });
      } catch {
        if (run?.runId) {
          try { await repository.failRun(Object.freeze({ runId: run.runId, safeFailure: failure, finishedAt: now().toISOString() })); } catch { /* leave failed run visible */ }
        }
        throw unavailable();
      } finally { token = undefined; }
    },
  });
}
