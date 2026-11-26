// Prepared staging worker only. It remains inert unless explicitly enabled.
// Do not add CLI date/account overrides; the runtime and database own scope checks.
const ENABLED = process.env.NIGHT_SCOUT_META_ADS_COLLECTOR_ENABLED === 'true';
if (!ENABLED) {
  process.stdout.write(`${JSON.stringify({ state: 'disabled' })}\n`);
} else {
  try {
    if (process.argv.length !== 2 || process.env.NIGHT_SCOUT_RUNTIME_ENV !== 'staging') {
      throw Error('Meta Ads staging worker unavailable');
    }
    const runtimeModule = await import('../../artifacts/api-server/src/lib/meta-ads-collector-runtime.mjs');
    const createRuntime = runtimeModule.createMetaAdsCollectorRuntime;
    if (typeof createRuntime !== 'function') throw Error('Meta Ads staging worker unavailable');
    const runtime = await createRuntime(process.env);
    if (!runtime) throw Error('Meta Ads staging worker unavailable');

    const counters = {
      accountsSeen: 0,
      complete: 0,
      partial: 0,
      alreadyCollected: 0,
      alreadyRunning: 0,
      failed: 0,
    };
    try {
      await runtime.expirePendingConnections();
      const accounts = await runtime.listActiveAccounts();
      if (!Array.isArray(accounts) || accounts.length > 1_000) throw Error('Meta Ads staging worker unavailable');
      counters.accountsSeen = accounts.length;

      const runAt = new Date();
      const scheduledUtcDay = runAt.toISOString().slice(0, 10);
      const retryOrdinal = process.env.NIGHT_SCOUT_META_ADS_RETRY_ORDINAL ?? '0';
      if (!/^(0|[1-9][0-9]?)$/.test(retryOrdinal)) throw Error('Meta Ads staging worker unavailable');

      for (const account of accounts) {
        if (!account || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(account.storeId ?? '')
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(account.connectionId ?? '')
          || !/^\d{5,32}$/.test(account.accountId ?? '')
          || !/^[A-Z]{3}$/.test(account.currency ?? '')
          || typeof account.timeZone !== 'string' || account.timeZone.length < 1 || account.timeZone.length > 128) {
          counters.failed += 1;
          continue;
        }

        let to;
        try {
          const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
            timeZone: account.timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).formatToParts(runAt).map((part) => [part.type, part.value]));
          to = `${parts.year}-${parts.month}-${parts.day}`;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) throw Error('invalid account timezone');
        } catch {
          counters.failed += 1;
          continue;
        }

        const asDate = new Date(`${to}T00:00:00.000Z`);
        asDate.setUTCDate(asDate.getUTCDate() - 1);
        to = asDate.toISOString().slice(0, 10);
        const fromDate = new Date(`${to}T00:00:00.000Z`);
        fromDate.setUTCDate(fromDate.getUTCDate() - 30);
        const from = fromDate.toISOString().slice(0, 10);
        const idempotencyKey = `meta_daily:${account.accountId}:${from}:${to}:${scheduledUtcDay}:r${retryOrdinal}`;

        try {
          const result = await runtime.collector.collect(Object.freeze({
            storeId: account.storeId,
            connectionId: account.connectionId,
            accountId: account.accountId,
            from,
            to,
            idempotencyKey,
          }));
          if (result?.status === 'complete') counters.complete += 1;
          else if (result?.status === 'partial') counters.partial += 1;
          else if (result?.status === 'already_collected') counters.alreadyCollected += 1;
          else if (result?.status === 'already_running') counters.alreadyRunning += 1;
          else counters.failed += 1;
        } catch {
          counters.failed += 1;
        }
      }
    } finally {
      await runtime.close();
    }

    const state = counters.failed > 0 ? 'partial_failure' : counters.partial > 0 ? 'partial' : 'complete';
    process.stdout.write(`${JSON.stringify({ state, cleanup: 'complete', ...counters })}\n`);
    if (counters.failed > 0) process.exitCode = 1;
  } catch {
    process.stderr.write('Meta Ads staging collector unavailable; inspect safe runtime diagnostics before retrying\n');
    process.exitCode = 1;
  }
}
