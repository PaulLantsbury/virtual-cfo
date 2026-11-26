const unavailable = () => new Error('Google Ads staging acceptance unavailable');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const customer = /^\d{10}$/;
const day = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const dayDistance = (from, to) => (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;

/** Runs one no-schedule, staging-only bounded historical collection. */
export async function runGoogleAdsAcceptance({ env, createRuntime, now = () => new Date() } = {}) {
  if (!env || typeof createRuntime !== 'function' || typeof now !== 'function') throw unavailable();
  const enabled = env.NIGHT_SCOUT_RUNTIME_ENV === 'staging'
    && env.NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_RUNTIME_ENABLED === 'true'
    && env.NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_ENABLED === 'true'
    && env.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_ENABLED === 'true';
  if (!enabled) return Object.freeze({ state: 'disabled' });
  const storeId = env.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_STORE_ID;
  const configuredStoreId = env.NIGHT_SCOUT_GOOGLE_ADS_STAGING_STORE_ID;
  const from = env.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_FROM;
  const to = env.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_TO;
  const ordinal = env.NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_RETRY_ORDINAL ?? '0';
  if (!uuid.test(storeId ?? '') || storeId !== configuredStoreId || !day(from) || !day(to)
    || from > to || dayDistance(from, to) > 13 || !/^(0|[1-9][0-9]?)$/.test(ordinal)) throw unavailable();
  const observedNow = now();
  if (!(observedNow instanceof Date) || !Number.isFinite(observedNow.valueOf())) throw unavailable();
  const runtime = await createRuntime(env);
  if (!runtime || !runtime.collector || typeof runtime.listActiveAccounts !== 'function'
    || typeof runtime.close !== 'function') throw unavailable();
  try {
    const accounts = await runtime.listActiveAccounts();
    if (!Array.isArray(accounts) || accounts.length > 5_000) throw unavailable();
    const scoped = accounts.filter((account) => account?.storeId === storeId);
    if (scoped.length !== 1) throw unavailable();
    const account = scoped[0];
    if (!uuid.test(account.connectionId ?? '') || !customer.test(account.customerId ?? '')
      || !/^[A-Z]{3}$/.test(account.currency ?? '') || typeof account.timeZone !== 'string'
      || account.timeZone.length < 1 || account.timeZone.length > 128) throw unavailable();
    try { new Intl.DateTimeFormat('en', { timeZone: account.timeZone }); } catch { throw unavailable(); }
    const localParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: account.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(observedNow).map((part) => [part.type, part.value]));
    const localToday = `${localParts.year}-${localParts.month}-${localParts.day}`;
    if (!day(localToday)) throw unavailable();
    const latestCompleted = new Date(`${localToday}T00:00:00.000Z`);
    latestCompleted.setUTCDate(latestCompleted.getUTCDate() - 1);
    const latest = latestCompleted.toISOString().slice(0, 10);
    if (to > latest) throw unavailable();

    const result = await runtime.collector.collect(Object.freeze({
      storeId,
      connectionId: account.connectionId,
      customerId: account.customerId,
      from,
      to,
      idempotencyKey: `google_accept:${account.customerId}:${from}:${to}:r${ordinal}`,
    }));
    if (!result || !['complete', 'partial', 'already_collected', 'already_running'].includes(result.status)
      || result.from !== from || result.to !== to || !uuid.test(result.runId ?? '')) throw unavailable();
    if (result.status === 'already_running') return Object.freeze({
      state: 'already_running', runId: result.runId, from, to,
      currency: account.currency, timeZone: account.timeZone,
    });
    if (result.status === 'already_collected') return Object.freeze({
      state: 'already_collected', runId: result.runId, from, to,
      currency: account.currency, timeZone: account.timeZone,
    });
    if (!Array.isArray(result.coverage) || result.coverage.length !== dayDistance(from, to) + 1
      || typeof result.observedAt !== 'string' || !Number.isFinite(Date.parse(result.observedAt))) throw unavailable();
    let totalMicros = 0n;
    const counts = { provider_row: 0, no_row: 0 };
    for (let index = 0; index < result.coverage.length; index += 1) {
      const item = result.coverage[index];
      const expectedDay = new Date(`${from}T00:00:00.000Z`);
      expectedDay.setUTCDate(expectedDay.getUTCDate() + index);
      const expected = expectedDay.toISOString().slice(0, 10);
      if (!item || item.date !== expected || !Object.hasOwn(counts, item.state)) throw unavailable();
      if (item.state === 'provider_row') {
        if (typeof item.spendMicros !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(item.spendMicros)) throw unavailable();
        const amount = BigInt(item.spendMicros);
        if (amount > 9_223_372_036_854_775_807n) throw unavailable();
        totalMicros += amount;
      } else if (item.spendMicros !== null) throw unavailable();
      counts[item.state] += 1;
    }
    return Object.freeze({
      state: totalMicros > 0n ? result.status : 'zero_spend',
      positiveSpendObserved: totalMicros > 0n,
      coverage: Object.freeze(counts),
      runId: result.runId,
      from,
      to,
      observedAt: result.observedAt,
      currency: account.currency,
      timeZone: account.timeZone,
    });
  } finally { await runtime.close(); }
}
