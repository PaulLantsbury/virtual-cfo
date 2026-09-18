import { nightlyPlan } from './nightly-plan.mjs';
import { rollingReportingScope } from './rolling-reporting-scope.mjs';

// Pure local read model. It deliberately neither reads a database nor starts a
// collection. A status is operational evidence only, never financial coverage
// certification or a reason to retry an uncertain run.
const failure = () => new Error('Explicit trustworthy nightly status evidence is required');
const DAY = 86_400_000;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const instant = value => {
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?Z$/);
  if (!match) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === match[1];
};
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function exactObject(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure();
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw failure();
  return value;
}

function scope(value) {
  exactObject(value, ['from', 'to', 'timezone', 'calendarDays']);
  if (!date(value.from) || !date(value.to) || typeof value.timezone !== 'string' || value.calendarDays !== 31 || value.from > value.to || (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / DAY !== 30) throw failure();
  return Object.freeze({ from: value.from, to: value.to, timezone: value.timezone, calendarDays: 31 });
}

function claim(value) {
  if (value === null) return null;
  exactObject(value, ['localDate', 'state', 'scheduledAt', 'from', 'to']);
  if (!date(value.localDate) || !['running', 'completed', 'unconfirmed'].includes(value.state) || !instant(value.scheduledAt) || !date(value.from) || !date(value.to)) throw failure();
  return Object.freeze({ ...value });
}

function attempt(value) {
  if (value === null) return null;
  exactObject(value, ['state', 'startedAt', 'finishedAt', 'from', 'to', 'resultCode']);
  if (!['running', 'completed', 'unconfirmed'].includes(value.state) || !instant(value.startedAt) || (value.finishedAt !== null && !instant(value.finishedAt)) || !date(value.from) || !date(value.to)) throw failure();
  if (value.state === 'completed' && typeof value.resultCode !== 'string') throw failure();
  if (value.state !== 'completed' && (value.resultCode !== null || value.finishedAt !== null)) throw failure();
  return Object.freeze({ ...value });
}

function sameScope(a, b) { return a.from === b.from && a.to === b.to; }

/**
 * Projects known nightly evidence for one local store date. `claim` and
 * `latestAttempt` must already be safely scoped server-side. Passing null is
 * meaningful; omitting either field is rejected so a caller cannot turn an
 * unavailable history read into a reassuring status.
 */
export function projectNightlyStatus({ now, timezone, claim: claimInput, latestAttempt: attemptInput, historyState } = {}) {
  if (!['available', 'unavailable'].includes(historyState) || !own(arguments[0] ?? {}, 'claim') || !own(arguments[0] ?? {}, 'latestAttempt')) throw failure();
  const selectedScope = rollingReportingScope({ now, timezone });
  const nextScope = scope({ from: selectedScope.from, to: selectedScope.to, timezone: selectedScope.timezone, calendarDays: selectedScope.calendarDays });
  const plan = nightlyPlan(now, timezone);
  const expectedScope = nextScope;
  const record = historyState === 'available' ? claim(claimInput) : null;
  const latestAttempt = historyState === 'available' ? attempt(attemptInput) : null;
  if (historyState === 'unavailable' && (claimInput !== null || attemptInput !== null)) throw failure();

  const base = {
    localDate: plan.localDate,
    timezone,
    scheduledAt: plan.scheduledAt,
    reportingScope: expectedScope,
    financeImported: false,
    coverageCertified: false,
    retryPermitted: false,
  };
  if (historyState === 'unavailable') return Object.freeze({ ...base, state: 'history_unavailable', reviewRequired: true, reason: 'Durable nightly history could not be read; do not infer a missed or successful collection.' });
  if (record && (record.localDate !== plan.localDate || record.scheduledAt !== plan.scheduledAt)) throw failure();
  if (record && !sameScope(record, expectedScope)) return Object.freeze({ ...base, state: 'claim_scope_mismatch', reviewRequired: true, reason: 'The durable claim belongs to a different reporting scope.' });
  if (latestAttempt && !sameScope(latestAttempt, expectedScope)) return Object.freeze({ ...base, state: 'attempt_scope_mismatch', reviewRequired: true, reason: 'The latest durable attempt belongs to a different reporting scope.' });
  if (record?.state === 'unconfirmed' || latestAttempt?.state === 'unconfirmed' || latestAttempt?.state === 'running') return Object.freeze({ ...base, state: 'run_unconfirmed', reviewRequired: true, reason: 'A durable run is unresolved; inspect it before any retry.' });
  if (record?.state === 'running') return Object.freeze({ ...base, state: 'run_in_progress', reviewRequired: false, reason: 'A durable claim is running.' });
  if (record?.state === 'completed' && latestAttempt?.state === 'completed') return Object.freeze({ ...base, state: 'completed_requires_review', reviewRequired: true, resultCode: latestAttempt.resultCode, reason: 'Collection completed but financial coverage still requires review.' });
  if (record?.state === 'completed') return Object.freeze({ ...base, state: 'completed_attempt_not_visible', reviewRequired: true, reason: 'The claim completed but matching durable attempt evidence is absent.' });

  const scheduledAt = Date.parse(plan.scheduledAt);
  const nowAt = Date.parse(now);
  if (nowAt < scheduledAt) return Object.freeze({ ...base, state: 'scheduled_not_due', reviewRequired: false, reason: 'The next nightly window has not opened.' });
  if (nowAt < scheduledAt + 15 * 60_000) return Object.freeze({ ...base, state: 'scheduled_window_open', reviewRequired: false, reason: 'The nightly startup window is open; no claim is recorded yet.' });
  return Object.freeze({ ...base, state: 'missing_run_requires_review', reviewRequired: true, reason: 'The startup window passed with no durable claim. Do not create a catch-up run automatically.' });
}
