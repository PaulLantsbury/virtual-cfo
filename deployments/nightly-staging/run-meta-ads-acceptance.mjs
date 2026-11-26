// One-off, staging-only historical acceptance collection.
// Disabled by default; takes no CLI arguments or provider account override.
const env = process.env;
const enabled = env.NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED === 'true'
  && env.NIGHT_SCOUT_META_ADS_COLLECTOR_ENABLED === 'true'
  && env.NIGHT_SCOUT_META_ADS_ACCEPTANCE_ENABLED === 'true';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accountPattern = /^\d{5,32}$/;
const validDay = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const dayDistance = (from, to) => (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;
function subtractMonths(day, months) {
  const date = new Date(`${day}T00:00:00.000Z`), dayOfMonth = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(dayOfMonth, lastDay));
  return date.toISOString().slice(0, 10);
}
const disabled = () => process.stdout.write(`${JSON.stringify({ state: 'disabled' })}\n`);
const unavailable = () => {
  process.stderr.write('Meta Ads staging acceptance collection unavailable; review the staging checklist\n');
  process.exitCode = 1;
};

if (process.argv.length !== 2) {
  unavailable();
} else if (!enabled) {
  disabled();
} else {
  let runtime;
  try {
    if (env.NIGHT_SCOUT_RUNTIME_ENV !== 'staging') throw Error('unavailable');
    const storeId = env.NIGHT_SCOUT_META_ADS_ACCEPTANCE_STORE_ID;
    const stagedStoreId = env.NIGHT_SCOUT_META_ADS_STAGING_STORE_ID;
    const from = env.NIGHT_SCOUT_META_ADS_ACCEPTANCE_FROM;
    const to = env.NIGHT_SCOUT_META_ADS_ACCEPTANCE_TO;
    if (!uuid.test(storeId ?? '') || storeId !== stagedStoreId
      || !validDay(from) || !validDay(to) || from > to || dayDistance(from, to) > 13) throw Error('unavailable');

    const runtimeModule = await import('../../artifacts/api-server/src/lib/meta-ads-collector-runtime.mjs');
    if (typeof runtimeModule.createMetaAdsCollectorRuntime !== 'function') throw Error('unavailable');
    runtime = await runtimeModule.createMetaAdsCollectorRuntime(env);
    if (!runtime) throw Error('unavailable');

    const activeAccounts = await runtime.listActiveAccounts();
    if (!Array.isArray(activeAccounts) || activeAccounts.length > 5_000) throw Error('unavailable');
    const selected = activeAccounts.filter((account) => account?.storeId === storeId);
    if (selected.length !== 1) throw Error('unavailable');
    const account = selected[0];
    if (!uuid.test(account.connectionId ?? '') || !accountPattern.test(account.accountId ?? '')
      || !/^[A-Z]{3}$/.test(account.currency ?? '')
      || typeof account.timeZone !== 'string' || account.timeZone.length < 1 || account.timeZone.length > 128) throw Error('unavailable');
    try { new Intl.DateTimeFormat('en', { timeZone: account.timeZone }); } catch { throw Error('unavailable'); }

    const now = new Date();
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: account.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now).map((part) => [part.type, part.value]));
    const localToday = `${parts.year}-${parts.month}-${parts.day}`;
    if (!validDay(localToday)) throw Error('unavailable');
    const latestCompleted = new Date(`${localToday}T00:00:00.000Z`);
    latestCompleted.setUTCDate(latestCompleted.getUTCDate() - 1);
    const latestCompletedLocalDay = latestCompleted.toISOString().slice(0, 10);
    if (from < subtractMonths(localToday, 37) || to > latestCompletedLocalDay) throw Error('unavailable');
    const retryOrdinal = env.NIGHT_SCOUT_META_ADS_ACCEPTANCE_RETRY_ORDINAL ?? '0';
    if (!/^(0|[1-9][0-9]?)$/.test(retryOrdinal)) throw Error('unavailable');

    const idempotencyKey = `meta_accept:${account.accountId}:${from}:${to}:r${retryOrdinal}`;
    const result = await runtime.collector.collect(Object.freeze({
      storeId,
      connectionId: account.connectionId,
      accountId: account.accountId,
      from,
      to,
      idempotencyKey,
    }));
    if (!result || !['complete', 'partial', 'already_collected', 'already_running'].includes(result.status)
      || !Array.isArray(result.coverage) && ['complete', 'partial'].includes(result.status)) throw Error('unavailable');
    if (result.from !== from || result.to !== to || !uuid.test(result.runId ?? '')) throw Error('unavailable');
    if (['complete', 'partial'].includes(result.status)
      && (result.coverage.length !== dayDistance(from, to) + 1
        || typeof result.observedAt !== 'string' || !Number.isFinite(Date.parse(result.observedAt)))) throw Error('unavailable');

    let coverage = null;
    if (Array.isArray(result.coverage)) {
      coverage = { provider_row: 0, no_row: 0, partial: 0, failed: 0 };
      for (const day of result.coverage) {
        if (!day || !Object.hasOwn(coverage, day.state)) throw Error('unavailable');
        coverage[day.state] += 1;
      }
    }
    const state = result.status === 'already_collected' ? 'already_collected'
      : result.status === 'already_running' ? 'already_running' : result.status;
    process.stdout.write(`${JSON.stringify({
      state,
      currency: account.currency,
      timeZone: account.timeZone,
      from: result.from ?? from,
      to: result.to ?? to,
      runId: result.runId,
      observedAt: result.observedAt ?? null,
      coverage,
    })}\n`);
    if (state === 'already_running') process.exitCode = 1;
  } catch {
    unavailable();
  } finally {
    try { await runtime?.close(); } catch { unavailable(); }
  }
}
