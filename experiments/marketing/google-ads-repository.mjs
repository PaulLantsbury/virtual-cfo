const fail = () => new Error('Google Ads persistence unavailable');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const customerIdPattern = /^\d{10}$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const idempotencyPattern = /^[A-Za-z0-9._:-]{16,200}$/;
const states = new Set(['pending', 'connected', 'reauthorization_required', 'disconnected', 'revoked']);
const runStates = new Set(['running', 'complete', 'partial', 'failed']);
const failures = new Set(['token_expired', 'access_revoked', 'provider_unavailable', 'invalid_response', 'scope_missing']);

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function validDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function timestamp(value, nullable = false) {
  if (nullable && value === null) return null;
  if (value === null || value === undefined) throw fail();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw fail();
  return date.toISOString();
}

function decodeBytea(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && /^\\x(?:[0-9a-f]{2})+$/i.test(value)) return Buffer.from(value.slice(2), 'hex');
  throw fail();
}

function digestArg(value) {
  if (!Buffer.isBuffer(value) || value.length !== 32) throw fail();
  return `\\x${value.toString('hex')}`;
}

function jsonText(value) {
  try { return JSON.stringify(value); } catch { throw fail(); }
}

function decodeJson(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { throw fail(); }
  }
  return value;
}

function statusRow(row) {
  if (!plain(row) || !uuidPattern.test(row.connection_id ?? '') || !states.has(row.connection_status)
    || !['testing', 'production'].includes(row.oauth_app_publishing_status)) throw fail();
  const customerId = row.customer_id;
  const loginCustomerId = row.login_customer_id;
  const currency = row.currency;
  const timeZone = row.timezone_name;
  if ((customerId !== null && !customerIdPattern.test(customerId ?? ''))
    || (loginCustomerId !== null && !customerIdPattern.test(loginCustomerId ?? ''))
    || (currency !== null && !/^[A-Z]{3}$/.test(currency ?? ''))
    || (timeZone !== null && (typeof timeZone !== 'string' || timeZone.length < 1 || timeZone.length > 128))) throw fail();
  if (timeZone !== null) {
    try { new Intl.DateTimeFormat('en', { timeZone }); } catch { throw fail(); }
  }
  if (row.oauth_app_publishing_status === 'testing' && row.reauthorize_by === null) throw fail();
  if (row.oauth_app_publishing_status === 'production' && row.reauthorize_by !== null) throw fail();

  const runId = row.latest_run_id;
  let latestRun = null;
  if (runId !== null) {
    if (!uuidPattern.test(runId ?? '') || !runStates.has(row.latest_run_status)
      || (row.latest_run_safe_failure !== null && !failures.has(row.latest_run_safe_failure))
      || !Number.isInteger(row.latest_run_pages_read) || row.latest_run_pages_read < 0 || row.latest_run_pages_read > 100
      || !validDay(row.latest_run_requested_from) || !validDay(row.latest_run_requested_to)
      || row.latest_run_requested_from > row.latest_run_requested_to
      || (row.latest_run_status === 'failed') !== (row.latest_run_safe_failure !== null)
      || (row.latest_run_status === 'running') !== (row.latest_run_finished_at === null)) throw fail();
    latestRun = Object.freeze({
      runId,
      status: row.latest_run_status,
      startedAt: timestamp(row.latest_run_started_at),
      finishedAt: timestamp(row.latest_run_finished_at, true),
      requestedFrom: row.latest_run_requested_from,
      requestedTo: row.latest_run_requested_to,
      safeFailure: row.latest_run_safe_failure,
      pagesRead: row.latest_run_pages_read,
    });
  } else if ([row.latest_run_status, row.latest_run_started_at, row.latest_run_finished_at,
    row.latest_run_requested_from, row.latest_run_requested_to, row.latest_run_safe_failure,
    row.latest_run_pages_read].some((value) => value !== null)) throw fail();

  return Object.freeze({
    connectionId: row.connection_id,
    status: row.connection_status,
    oauthAppPublishingStatus: row.oauth_app_publishing_status,
    reauthorizeBy: timestamp(row.reauthorize_by, true),
    customerId,
    loginCustomerId,
    currency,
    timeZone,
    // The current status RPC does not return an explicit collection-through
    // date or row updated_at; keep both unknown instead of deriving freshness
    // from a requested range or a connection timestamp.
    lastCollectedThrough: null,
    updatedAt: null,
    latestRun,
    connectedAt: timestamp(row.connected_at, true),
    disconnectedAt: timestamp(row.disconnected_at, true),
    credentialExpiresAt: timestamp(row.credential_expires_at, true),
  });
}

/**
 * Adapts the fixed Google Ads SECURITY DEFINER RPCs to the OAuth service
 * contract. It exposes no arbitrary SQL, table, or function-name input.
 * The SQL proposal and exact API-role grants must be reviewed/applied separately.
 */
export function createGoogleAdsApiRepository({ rpc }) {
  if (!rpc || typeof rpc.call !== 'function') throw fail();

  async function rows(name, args) {
    try {
      const result = await rpc.call(name, args);
      if (!Array.isArray(result)) throw fail();
      return result;
    } catch { throw fail(); }
  }

  async function one(name, args) {
    const result = await rows(name, args);
    if (result.length !== 1 || !plain(result[0])) throw fail();
    return result[0];
  }

  return Object.freeze({
    async createOAuthState({ stateDigest, userId, storeId, expiresAt }) {
      if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '')
        || !Number.isFinite(Date.parse(expiresAt))) throw fail();
      const result = await one('google_ads_v1.worker_create_oauth_state', [
        digestArg(stateDigest), userId, storeId, expiresAt,
      ]);
      if (result.created !== true) throw fail();
    },

    async consumeOAuthState({ stateDigest, now }) {
      if (!Number.isFinite(Date.parse(now))) throw fail();
      const result = await rows('google_ads_v1.worker_consume_oauth_state', [digestArg(stateDigest), now]);
      if (result.length === 0) return null;
      if (result.length !== 1 || !plain(result[0])) throw fail();
      const userId = result[0].user_id;
      const storeId = result[0].store_id;
      if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '')) throw fail();
      return Object.freeze({ userId, storeId });
    },

    async createPendingConnection(input) {
      if (!plain(input) || !uuidPattern.test(input.connectionId ?? '') || !uuidPattern.test(input.userId ?? '')
        || !uuidPattern.test(input.storeId ?? '') || !Array.isArray(input.grantedScopes)
        || input.grantedScopes.length !== 1 || input.grantedScopes[0] !== 'https://www.googleapis.com/auth/adwords'
        || !['testing', 'production'].includes(input.oauthAppPublishingStatus)
        || !Number.isFinite(Date.parse(input.selectionExpiresAt))
        || !Buffer.isBuffer(input.selectionHandleDigest) || input.selectionHandleDigest.length !== 32
        || !Array.isArray(input.accountSelections) || input.accountSelections.length < 1 || input.accountSelections.length > 5_000
        || !plain(input.encryptedCredential)) throw fail();
      const seen = new Set();
      for (const account of input.accountSelections) {
        if (!plain(account) || !customerIdPattern.test(account.customerId ?? '')
          || (account.loginCustomerId !== null && !customerIdPattern.test(account.loginCustomerId ?? ''))
          || account.loginCustomerId === account.customerId) throw fail();
        const key = `${account.loginCustomerId ?? ''}:${account.customerId}`;
        if (seen.has(key)) throw fail();
        seen.add(key);
      }
      const credential = input.encryptedCredential;
      if (!Buffer.isBuffer(credential.ciphertext) || credential.ciphertext.length < 1 || credential.ciphertext.length > 16_384
        || !Buffer.isBuffer(credential.encryptedDek) || credential.encryptedDek.length < 1 || credential.encryptedDek.length > 16_384
        || credential.algorithm !== 'AES-256-GCM' || typeof credential.keyVersion !== 'string'
        || !/^[A-Za-z0-9._-]{1,128}$/.test(credential.keyVersion)) throw fail();
      const result = await one('google_ads_v1.worker_create_pending_connection', [
        input.connectionId,
        input.userId,
        input.storeId,
        input.grantedScopes,
        input.oauthAppPublishingStatus,
        `\\x${credential.ciphertext.toString('hex')}`,
        `\\x${credential.encryptedDek.toString('hex')}`,
        credential.keyVersion,
        credential.algorithm,
        digestArg(input.selectionHandleDigest),
        input.selectionExpiresAt,
        jsonText(input.accountSelections),
      ]);
      return Object.freeze({ created: result.created === true });
    },

    async readPendingCredential({ selectionHandleDigest, userId, storeId, now }) {
      if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '') || !Number.isFinite(Date.parse(now))) throw fail();
      const result = await rows('google_ads_v1.worker_read_pending_credential', [
        digestArg(selectionHandleDigest), userId, storeId, now,
      ]);
      if (result.length === 0) return null;
      if (result.length !== 1 || !plain(result[0])) throw fail();
      const row = result[0];
      const connectionId = row.connection_id;
      const accountSelections = decodeJson(row.account_selections);
      if (!uuidPattern.test(connectionId ?? '') || !Array.isArray(accountSelections)
        || !['testing', 'production'].includes(row.oauth_app_publishing_status)
        || !Number.isInteger(row.credential_version) || row.credential_version < 1
        || row.algorithm !== 'AES-256-GCM'
        || typeof row.key_version !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(row.key_version)) throw fail();
      for (const account of accountSelections) {
        if (!plain(account) || !customerIdPattern.test(account.customerId ?? '')
          || (account.loginCustomerId !== null && !customerIdPattern.test(account.loginCustomerId ?? ''))) throw fail();
      }
      return Object.freeze({
        connectionId,
        oauthAppPublishingStatus: row.oauth_app_publishing_status,
        reauthorizeBy: timestamp(row.reauthorize_by, true),
        credentialExpiresAt: timestamp(row.credential_expires_at, true),
        ciphertext: decodeBytea(row.ciphertext),
        encryptedDek: decodeBytea(row.encrypted_dek),
        keyVersion: row.key_version,
        algorithm: row.algorithm,
        credentialVersion: row.credential_version,
        selectionExpiresAt: timestamp(row.selection_expires_at),
        accountSelections: Object.freeze(accountSelections.map((account) => Object.freeze({
          customerId: account.customerId,
          loginCustomerId: account.loginCustomerId ?? null,
        }))),
      });
    },

    async activateSelectedAccount({ selectionHandleDigest, userId, storeId, customerId, loginCustomerId, currency, timeZone, now }) {
      if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '') || !customerIdPattern.test(customerId ?? '')
        || (loginCustomerId !== null && !customerIdPattern.test(loginCustomerId ?? ''))
        || !/^[A-Z]{3}$/.test(currency ?? '') || typeof timeZone !== 'string' || timeZone.length < 1 || timeZone.length > 128
        || !Number.isFinite(Date.parse(now))) throw fail();
      try { new Intl.DateTimeFormat('en', { timeZone }); } catch { throw fail(); }
      const result = await rows('google_ads_v1.worker_activate_selected_account', [
        digestArg(selectionHandleDigest), userId, storeId, customerId, loginCustomerId, currency, timeZone, now,
      ]);
      if (result.length === 0) return null;
      if (result.length !== 1 || !plain(result[0])) throw fail();
      if (result[0].customer_id !== customerId || (result[0].login_customer_id ?? null) !== loginCustomerId
        || result[0].currency !== currency || result[0].timezone_name !== timeZone) throw fail();
      return Object.freeze({
        customerId: result[0].customer_id,
        loginCustomerId: result[0].login_customer_id ?? null,
        currency: result[0].currency,
        timeZone: result[0].timezone_name,
        connectedAt: timestamp(result[0].connected_at),
      });
    },

    async disconnectConnection({ userId, storeId, connectionId, now }) {
      if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '') || !uuidPattern.test(connectionId ?? '')
        || !Number.isFinite(Date.parse(now))) throw fail();
      const result = await one('google_ads_v1.worker_disconnect_connection', [connectionId, userId, storeId, now]);
      if (result.completed !== true) throw fail();
      return Object.freeze({ disconnected: true });
    },

    async readStoreStatus({ userId, storeId, now }) {
      if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '') || !Number.isFinite(Date.parse(now))) throw fail();
      const result = await rows('google_ads_v1.worker_read_store_status', [userId, storeId, now]);
      if (result.length > 100) throw fail();
      const seen = new Set();
      return Object.freeze(result.map((row) => {
        const status = statusRow(row);
        if (seen.has(status.connectionId)) throw fail();
        seen.add(status.connectionId);
        return status;
      }));
    },
  });
}
