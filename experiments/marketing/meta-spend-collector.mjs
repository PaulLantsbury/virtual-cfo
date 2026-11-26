import { readMetaDailySpend } from './meta-spend-reader.mjs';

const fail = () => new Error('Meta Ads collection unavailable');
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const accountPattern = /^\d{5,32}$/;
const versionPattern = /^v\d+\.\d+$/;
const idempotencyPattern = /^[A-Za-z0-9._:-]{16,200}$/;

function isDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(day, amount) {
  const parsed = new Date(`${day}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function dayCount(from, to) {
  return (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1;
}

function localDay(instant, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const day = `${values.year}-${values.month}-${values.day}`;
    if (!isDay(day)) throw fail();
    return day;
  } catch { throw fail(); }
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || typeof input.storeId !== 'string' || input.storeId.length < 1 || input.storeId.length > 200
    || typeof input.connectionId !== 'string' || input.connectionId.length < 1 || input.connectionId.length > 200
    || !accountPattern.test(input.accountId ?? '')
    || !idempotencyPattern.test(input.idempotencyKey ?? '')
    || !isDay(input.from) || !isDay(input.to) || input.from > input.to
    || dayCount(input.from, input.to) > 93) throw fail();
}

function validateSelectedAccount(value, requested) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.provider !== 'meta_ads'
    || value.accountId !== requested.accountId
    || !/^[A-Z]{3}$/.test(value.currency ?? '')
    || typeof value.timeZone !== 'string' || value.timeZone.length < 1 || value.timeZone.length > 128
    || !versionPattern.test(value.apiVersion ?? '')) throw fail();
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { throw fail(); }
  return value;
}

function dayCoverage(from, to, rows, missingDates, accountId, currency) {
  if (missingDates.length > 93 || new Set(missingDates).size !== missingDates.length
    || missingDates.some((date) => !isDay(date) || date < from || date > to)) throw fail();
  const rowByDate = new Map(rows.map((row) => [row.date, row]));
  if (rowByDate.size !== rows.length || rows.some((row) => !row || row.provider !== 'meta_ads'
    || row.accountId !== accountId
    || !isDay(row.date) || row.date < from || row.date > to
    || row.currency !== currency
    || typeof row.spendMinor !== 'string' || !/^\d+$/.test(row.spendMinor)
    || Object.keys(row).some((key) => !['provider', 'accountId', 'date', 'currency', 'spendMinor'].includes(key)))) throw fail();
  const missing = new Set(missingDates);
  if ([...rowByDate.keys()].some((date) => missing.has(date))) throw fail();
  const coverage = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const row = rowByDate.get(date);
    if (row) {
      coverage.push(Object.freeze({ date, state: 'provider_row', spendMinor: row.spendMinor }));
    } else if (missing.has(date)) {
      coverage.push(Object.freeze({ date, state: 'no_row', spendMinor: null }));
    } else {
      // The adapter is required to account for every date in its requested range.
      throw fail();
    }
  }
  return Object.freeze(coverage);
}

/**
 * Orchestrates one bounded Meta account/day spend read. The injected credential
 * provider must derive the token from the server-side encrypted envelope after
 * checking the owner/store/account binding. The repository must expose fixed,
 * tenant-bound operations (not arbitrary SQL/table access).
 */
export function createMetaSpendCollector({
  credentialProvider,
  repository,
  reader = readMetaDailySpend,
  now = () => new Date(),
}) {
  if (!credentialProvider || typeof credentialProvider.getSelectedAccount !== 'function'
    || typeof credentialProvider.getAccessToken !== 'function'
    || !repository || typeof repository.beginRun !== 'function'
    || typeof repository.completeRun !== 'function' || typeof repository.failRun !== 'function'
    || typeof reader !== 'function' || typeof now !== 'function') throw fail();

  return Object.freeze({
    async collect(input) {
      validateInput(input);
      let run;
      let token;
      let failureReason = 'provider_unavailable';
      try {
        const selected = validateSelectedAccount(
          await credentialProvider.getSelectedAccount(Object.freeze({
            storeId: input.storeId,
            connectionId: input.connectionId,
            accountId: input.accountId,
          })),
          input,
        );

        const startedAt = now();
        if (!(startedAt instanceof Date) || !Number.isFinite(startedAt.valueOf())) throw fail();
        const lastCompletedLocalDay = addDays(localDay(startedAt, selected.timeZone), -1);
        const effectiveTo = input.to < lastCompletedLocalDay ? input.to : lastCompletedLocalDay;
        if (input.from > effectiveTo) throw fail();
        if (dayCount(input.from, effectiveTo) > 93) throw fail();

        run = await repository.beginRun(Object.freeze({
          idempotencyKey: input.idempotencyKey,
          storeId: input.storeId,
          connectionId: input.connectionId,
          accountId: input.accountId,
          requestedFrom: input.from,
          requestedTo: effectiveTo,
          currency: selected.currency,
          timeZone: selected.timeZone,
          apiVersion: selected.apiVersion,
          startedAt: startedAt.toISOString(),
        }));
        if (!run || typeof run.runId !== 'string' || run.runId.length < 1 || run.runId.length > 200) throw fail();
        if (run.alreadyComplete === true) {
          return Object.freeze({ status: 'already_collected', runId: run.runId, from: input.from, to: effectiveTo });
        }
        if (run.alreadyRunning === true) {
          return Object.freeze({ status: 'already_running', runId: run.runId, from: input.from, to: effectiveTo });
        }
        if (run.claimed !== true) throw fail();

        const credential = await credentialProvider.getAccessToken(Object.freeze({
          storeId: input.storeId,
          connectionId: input.connectionId,
          accountId: input.accountId,
        }));
        if (!credential || typeof credential.accessToken !== 'string' || credential.accessToken.length < 16
          || credential.accessToken.length > 16_384 || typeof credential.tokenExpiresAt !== 'string'
          || !Number.isFinite(Date.parse(credential.tokenExpiresAt))) throw fail();
        token = credential.accessToken;
        if (Date.parse(credential.tokenExpiresAt) <= startedAt.valueOf()) {
          failureReason = 'token_expired';
          throw fail();
        }

        const result = await reader({
          accessToken: token,
          accountId: input.accountId,
          from: input.from,
          to: effectiveTo,
          apiVersion: selected.apiVersion,
        });
        if (!result || result.provider !== 'meta_ads' || result.accountId !== input.accountId
          || result.currency !== selected.currency || result.timeZone !== selected.timeZone
          || result.requestedFrom !== input.from || result.requestedTo !== effectiveTo
          || !Array.isArray(result.rows) || !Array.isArray(result.missingDates)
          || !Number.isInteger(result.pagesRead) || result.pagesRead < 1 || result.pagesRead > 100
          || typeof result.retrievedAt !== 'string' || !Number.isFinite(Date.parse(result.retrievedAt))) {
          failureReason = 'invalid_response';
          throw fail();
        }

        let coverage;
        try {
          coverage = dayCoverage(input.from, effectiveTo, result.rows, result.missingDates, input.accountId, selected.currency);
        } catch { failureReason = 'invalid_response'; throw fail(); }
        const status = coverage.some((day) => day.state !== 'provider_row') ? 'partial' : 'complete';
        await repository.completeRun(Object.freeze({
          runId: run.runId,
          idempotencyKey: input.idempotencyKey,
          source: Object.freeze({
            provider: 'meta_ads',
            accountId: input.accountId,
            storeId: input.storeId,
            connectionId: input.connectionId,
            currency: result.currency,
            timeZone: result.timeZone,
            apiVersion: selected.apiVersion,
          }),
          requestedFrom: input.from,
          requestedTo: effectiveTo,
          observedAt: result.retrievedAt,
          pagesRead: result.pagesRead,
          status,
          coverage,
        }));
        return Object.freeze({ status, runId: run.runId, from: input.from, to: effectiveTo, observedAt: result.retrievedAt, coverage });
      } catch {
        if (run?.runId) {
          try {
            await repository.failRun(Object.freeze({
              runId: run.runId,
              safeFailure: failureReason,
              finishedAt: now().toISOString(),
            }));
          } catch { /* Preserve the original fixed safe error; run remains visibly unfinished if storage failed. */ }
        }
        throw fail();
      } finally {
        token = undefined;
      }
    },
  });
}
