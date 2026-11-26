const unavailable = () => new Error('Google Ads collection persistence unavailable');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const customer = /^\d{10}$/;
const idempotency = /^[A-Za-z0-9._:-]{16,200}$/;
const failures = new Set(['token_expired', 'access_revoked', 'provider_unavailable', 'invalid_response', 'scope_missing']);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;

function date(value) {
  if (value instanceof Date) value = value.toISOString();
  const result = new Date(value);
  if (!Number.isFinite(result.valueOf())) throw unavailable();
  return result.toISOString();
}

function decodeBytea(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && /^\\x(?:[0-9a-f]{2})+$/i.test(value)) return Buffer.from(value.slice(2), 'hex');
  throw unavailable();
}

function rpcRow(row) { if (!plain(row)) throw unavailable(); return row; }

/** Fixed RPC adapter for Google Ads collection only. */
export function createGoogleAdsCollectorRepository({ rpc, credentialEnvelope, apiVersion = 'v26' }) {
  if (!rpc || typeof rpc.call !== 'function' || !credentialEnvelope
    || typeof credentialEnvelope.decrypt !== 'function' || !/^v\d+$/.test(apiVersion)) throw unavailable();
  const call = async (name, args) => {
    try {
      const result = await rpc.call(name, args);
      if (!Array.isArray(result)) throw unavailable();
      return result;
    } catch { throw unavailable(); }
  };
  const one = async (name, args) => {
    const rows = await call(name, args);
    if (rows.length !== 1) throw unavailable();
    return rpcRow(rows[0]);
  };

  return Object.freeze({
    async listActiveAccounts(now = new Date().toISOString()) {
      const rows = await call('google_ads_v1.worker_list_active_accounts', [date(now)]);
      if (rows.length > 5_000) throw unavailable();
      const seen = new Set();
      return Object.freeze(rows.map((raw) => {
        const row = rpcRow(raw);
        const account = Object.freeze({
          storeId: row.store_id, connectionId: row.connection_id, customerId: row.customer_id,
          loginCustomerId: row.login_customer_id ?? null, currency: row.currency,
          timeZone: row.timezone_name,
        });
        const key = `${account.storeId}:${account.connectionId}:${account.customerId}`;
        if (!uuid.test(account.storeId ?? '') || !uuid.test(account.connectionId ?? '')
          || !customer.test(account.customerId ?? '')
          || (account.loginCustomerId !== null && !customer.test(account.loginCustomerId ?? ''))
          || !/^[A-Z]{3}$/.test(account.currency ?? '') || typeof account.timeZone !== 'string'
          || account.timeZone.length < 1 || account.timeZone.length > 128 || seen.has(key)) throw unavailable();
        try { new Intl.DateTimeFormat('en', { timeZone: account.timeZone }); } catch { throw unavailable(); }
        seen.add(key);
        return account;
      }));
    },

    async expirePendingConnections(now = new Date().toISOString()) {
      const result = await one('google_ads_v1.worker_expire_pending_connections', [date(now)]);
      if (result.completed !== true) throw unavailable();
    },

    async getSelectedAccount({ storeId, connectionId, customerId } = {}) {
      if (!uuid.test(storeId ?? '') || !uuid.test(connectionId ?? '') || !customer.test(customerId ?? '')) throw unavailable();
      const rows = await call('google_ads_v1.worker_get_selected_account', [storeId, connectionId, customerId]);
      if (rows.length !== 1) throw unavailable();
      const row = rpcRow(rows[0]);
      if (row.store_id !== storeId || row.connection_id !== connectionId || row.customer_id !== customerId
        || row.active !== true || !/^[A-Z]{3}$/.test(row.currency ?? '')
        || typeof row.timezone_name !== 'string' || row.timezone_name.length < 1 || row.timezone_name.length > 128) throw unavailable();
      try { new Intl.DateTimeFormat('en', { timeZone: row.timezone_name }); } catch { throw unavailable(); }
      return Object.freeze({
        storeId, connectionId, customerId, loginCustomerId: row.login_customer_id ?? null,
        active: true, currency: row.currency, timeZone: row.timezone_name,
      });
    },

    async getCredentialEnvelope({ storeId, connectionId, customerId } = {}) {
      if (!uuid.test(storeId ?? '') || !uuid.test(connectionId ?? '') || !customer.test(customerId ?? '')) throw unavailable();
      const rows = await call('google_ads_v1.worker_get_credential_envelope', [storeId, connectionId, customerId]);
      if (rows.length !== 1) throw unavailable();
      const row = rpcRow(rows[0]);
      if (row.store_id !== storeId || row.connection_id !== connectionId || row.customer_id !== customerId
        || row.active !== true || (row.login_customer_id ?? null) === customerId
        || row.algorithm !== 'AES-256-GCM' || typeof row.key_version !== 'string'
        || !Number.isFinite(Date.parse(date(row.credential_expires_at ?? Date.now() + 60_000)))) throw unavailable();
      return Object.freeze({
        connectionId, storeId, customerId,
        loginCustomerId: row.login_customer_id ?? null,
        credentialExpiresAt: row.credential_expires_at === null ? null : date(row.credential_expires_at),
        ciphertext: decodeBytea(row.ciphertext), encryptedDek: decodeBytea(row.encrypted_dek),
        algorithm: row.algorithm, keyVersion: row.key_version,
      });
    },

    async beginRun(input) {
      if (!plain(input) || !idempotency.test(input.idempotencyKey ?? '') || !uuid.test(input.storeId ?? '')
        || !uuid.test(input.connectionId ?? '') || !customer.test(input.customerId ?? '')
        || !/^[A-Z]{3}$/.test(input.currency ?? '') || typeof input.timeZone !== 'string'
        || !Number.isFinite(Date.parse(input.startedAt))) throw unavailable();
      const result = await one('google_ads_v1.worker_begin_collection_run', [
        input.idempotencyKey, input.storeId, input.connectionId, input.customerId,
        input.requestedFrom, input.requestedTo, input.currency, input.timeZone, input.apiVersion, input.startedAt,
      ]);
      const runId = result.run_id;
      if (runId !== null && !uuid.test(runId ?? '')) throw unavailable();
      if (runId === null) throw unavailable();
      return Object.freeze({ runId, alreadyComplete: result.already_complete === true,
        alreadyRunning: result.already_running === true, claimed: result.claimed === true });
    },

    async completeRun(input) {
      if (!plain(input) || !uuid.test(input.runId ?? '') || !idempotency.test(input.idempotencyKey ?? '')
        || !['complete', 'partial'].includes(input.status) || !Number.isInteger(input.pagesRead)
        || input.pagesRead < 1 || input.pagesRead > 20 || !Number.isFinite(Date.parse(input.observedAt))
        || !Array.isArray(input.coverage) || !plain(input.source)) throw unavailable();
      const coverage = input.coverage.map((item) => ({
        date: item.date, coverageState: item.state, spendMicros: item.spendMicros,
      }));
      const result = await one('google_ads_v1.worker_complete_collection_run', [
        input.runId, input.idempotencyKey, input.status, input.requestedFrom, input.requestedTo,
        input.observedAt, input.pagesRead, JSON.stringify(input.source), JSON.stringify(coverage),
      ]);
      if (result.completed !== true) throw unavailable();
    },

    async failRun({ runId, safeFailure, finishedAt } = {}) {
      if (!uuid.test(runId ?? '') || !failures.has(safeFailure) || !Number.isFinite(Date.parse(finishedAt))) throw unavailable();
      const result = await one('google_ads_v1.worker_fail_collection_run', [runId, safeFailure, finishedAt]);
      if (result.completed !== true) throw unavailable();
    },
  });
}
