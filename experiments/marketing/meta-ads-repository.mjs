const fail = () => new Error('Meta Ads persistence unavailable');
const accountPattern = /^\d{5,32}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const versionPattern = /^v\d+\.\d+$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const idempotencyPattern = /^[A-Za-z0-9._:-]{16,200}$/;
const allowedRuns = new Set(['running', 'complete', 'partial', 'failed']);
const allowedCoverage = new Set(['provider_row', 'no_row', 'partial', 'failed']);
const allowedConnections = new Set(['pending', 'connected', 'reauthorization_required', 'disconnected', 'revoked']);
const allowedFailures = new Set(['token_expired', 'access_revoked', 'provider_unavailable', 'invalid_response', 'scope_missing']);

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function decodeBytea(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && /^\\x(?:[0-9a-f]{2})+$/i.test(value)) return Buffer.from(value.slice(2), 'hex');
  throw fail();
}

function objectJson(value) {
  try { return JSON.stringify(value); } catch { throw fail(); }
}

function calendarDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function timestamp(value, nullable = false) {
  if (nullable && value === null) return null;
  if (value === null || value === undefined) throw fail();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw fail();
  return date.toISOString();
}

function statusRow(row) {
  if (!plain(row) || !uuidPattern.test(row.connection_id ?? '') || !allowedConnections.has(row.connection_status)) throw fail();
  const accountId = row.provider_account_id;
  const currency = row.currency;
  const timeZone = row.timezone_name;
  if (accountId !== null && !accountPattern.test(accountId ?? '')) throw fail();
  if (currency !== null && !/^[A-Z]{3}$/.test(currency ?? '')) throw fail();
  if (timeZone !== null) {
    if (typeof timeZone !== 'string' || timeZone.length < 1 || timeZone.length > 128) throw fail();
    try { new Intl.DateTimeFormat('en', { timeZone }); } catch { throw fail(); }
  }

  const latestRunId = row.latest_run_id;
  const latestRunStatus = row.latest_run_status;
  const latestRunSafeFailure = row.latest_run_safe_failure;
  const pagesRead = row.latest_run_pages_read;
  if (latestRunId === null) {
    if ([latestRunStatus, row.latest_run_started_at, row.latest_run_finished_at,
      row.latest_run_requested_from, row.latest_run_requested_to,
      latestRunSafeFailure, pagesRead].some((value) => value !== null)) throw fail();
  } else if (!uuidPattern.test(latestRunId ?? '') || !allowedRuns.has(latestRunStatus)
    || (latestRunSafeFailure !== null && !allowedFailures.has(latestRunSafeFailure))
    || !Number.isInteger(pagesRead) || pagesRead < 0 || pagesRead > 100
    || !calendarDay(row.latest_run_requested_from) || !calendarDay(row.latest_run_requested_to)
    || row.latest_run_requested_from > row.latest_run_requested_to
    || (latestRunStatus === 'failed') !== (latestRunSafeFailure !== null)
    || (latestRunStatus === 'running') !== (row.latest_run_finished_at === null)) throw fail();

  return Object.freeze({
    connectionId: row.connection_id,
    status: row.connection_status,
    connectedAt: timestamp(row.connected_at, true),
    disconnectedAt: timestamp(row.disconnected_at, true),
    tokenExpiresAt: timestamp(row.token_expires_at, true),
    accountId,
    currency,
    timeZone,
    latestRun: latestRunId === null ? null : Object.freeze({
      runId: latestRunId,
      status: latestRunStatus,
      startedAt: timestamp(row.latest_run_started_at),
      finishedAt: timestamp(row.latest_run_finished_at, true),
      from: row.latest_run_requested_from,
      to: row.latest_run_requested_to,
      safeFailure: latestRunSafeFailure,
      pagesRead,
    }),
  });
}

function validateCoverage(coverage, from, to) {
  if (!calendarDay(from) || !calendarDay(to) || from > to || !Array.isArray(coverage)
    || coverage.length < 1 || coverage.length > 93) throw fail();
  const expectedCount = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (coverage.length !== expectedCount) throw fail();
  const seen = new Set();
  const output = coverage.map((day, index) => {
    const expectedDate = addDays(from, index);
    if (!plain(day) || !calendarDay(day.date) || day.date !== expectedDate
      || seen.has(day.date) || !allowedCoverage.has(day.state)) throw fail();
    seen.add(day.date);
    const value = day.state === 'provider_row' ? day.spendMinor : null;
    if (day.state === 'provider_row' && (typeof value !== 'string' || !/^\d+$/.test(value))) throw fail();
    if (day.state !== 'provider_row' && day.spendMinor !== null) throw fail();
    return Object.freeze({ date: day.date, coverageState: day.state, spendMinor: value });
  });
  return Object.freeze(output);
}

/**
 * Fixed-name RPC adapter. It never accepts a table or function name from input.
 * The matching SECURITY DEFINER RPCs, worker role and least-privilege grants
 * must be prepared/reviewed separately before this adapter can be constructed.
 */
export function createMetaAdsRepository({ rpc, credentialEnvelope, apiVersion, now = () => new Date() }) {
  if (!rpc || typeof rpc.call !== 'function' || !credentialEnvelope
    || typeof credentialEnvelope.decrypt !== 'function' || !versionPattern.test(apiVersion ?? '')
    || typeof now !== 'function') throw fail();

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

  const repository = Object.freeze({
    async createOAuthState({ stateDigest, userId, storeId, expiresAt }) {
      if (!Buffer.isBuffer(stateDigest) || stateDigest.length !== 32 || !uuidPattern.test(userId ?? '')
        || !uuidPattern.test(storeId ?? '') || !Number.isFinite(Date.parse(expiresAt))) throw fail();
      const result = await one('meta_ads_v1.worker_create_oauth_state', [`\\x${stateDigest.toString('hex')}`, userId, storeId, expiresAt]);
      if (result.created !== true) throw fail();
    },

    async consumeOAuthState({ stateDigest, now: observedAt }) {
      if (!Buffer.isBuffer(stateDigest) || stateDigest.length !== 32 || !Number.isFinite(Date.parse(observedAt))) throw fail();
      const result = await rows('meta_ads_v1.worker_consume_oauth_state', [`\\x${stateDigest.toString('hex')}`, observedAt]);
      if (result.length === 0) return null;
      if (result.length !== 1 || !plain(result[0])) throw fail();
      const userId = result[0].user_id ?? result[0].userId;
      const storeId = result[0].store_id ?? result[0].storeId;
      if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '')) throw fail();
      return Object.freeze({ userId, storeId });
    },

    async createPendingConnection(input) {
      if (!plain(input) || !uuidPattern.test(input.connectionId ?? '') || !uuidPattern.test(input.userId ?? '')
        || !uuidPattern.test(input.storeId ?? '') || !Array.isArray(input.grantedScope)
        || input.grantedScope.length !== 1 || input.grantedScope[0] !== 'ads_read'
        || !Number.isFinite(Date.parse(input.tokenExpiresAt)) || !Number.isFinite(Date.parse(input.selectionExpiresAt))
        || !Buffer.isBuffer(input.selectionHandleDigest) || input.selectionHandleDigest.length !== 32
        || !Array.isArray(input.accounts) || input.accounts.length < 1 || input.accounts.length > 5_000
        || !plain(input.encryptedCredential)) throw fail();
      const credential = input.encryptedCredential;
      if (!Buffer.isBuffer(credential.ciphertext) || !Buffer.isBuffer(credential.encryptedDek)
        || credential.algorithm !== 'AES-256-GCM' || typeof credential.keyVersion !== 'string') throw fail();
      const result = await one('meta_ads_v1.worker_create_pending_connection', [
        input.connectionId,
        input.userId,
        input.storeId,
        input.grantedScope,
        input.tokenExpiresAt,
        `\\x${credential.ciphertext.toString('hex')}`,
        `\\x${credential.encryptedDek.toString('hex')}`,
        credential.keyVersion,
        credential.algorithm,
        `\\x${input.selectionHandleDigest.toString('hex')}`,
        input.selectionExpiresAt,
        objectJson(input.accounts),
      ]);
      return Object.freeze({ created: result.created === true });
    },

    async readPendingSelection({ selectionHandleDigest, userId, storeId, now: observedAt }) {
      if (!Buffer.isBuffer(selectionHandleDigest) || selectionHandleDigest.length !== 32
        || !uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '')
        || !Number.isFinite(Date.parse(observedAt))) throw fail();
      const result = await rows('meta_ads_v1.worker_read_pending_selection', [
        `\\x${selectionHandleDigest.toString('hex')}`, userId, storeId, observedAt,
      ]);
      if (result.length === 0) return null;
      if (result.length !== 1 || !plain(result[0]) || !Array.isArray(result[0].accounts)
        || typeof result[0].expires_at !== 'string') throw fail();
      return Object.freeze({ accounts: result[0].accounts, expiresAt: result[0].expires_at });
    },

    async cancelPendingSelection({ selectionHandleDigest, userId, storeId, now: observedAt }) {
      if (!Buffer.isBuffer(selectionHandleDigest) || selectionHandleDigest.length !== 32
        || !uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '')
        || !Number.isFinite(Date.parse(observedAt))) throw fail();
      const result = await one('meta_ads_v1.worker_cancel_pending_selection', [
        `\\x${selectionHandleDigest.toString('hex')}`, userId, storeId, observedAt,
      ]);
      if (typeof result.completed !== 'boolean') throw fail();
      return Object.freeze({ cancelled: result.completed });
    },

    async activateSelectedAccount({ selectionHandleDigest, userId, storeId, accountId, now: observedAt }) {
      if (!Buffer.isBuffer(selectionHandleDigest) || selectionHandleDigest.length !== 32
        || !uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '')
        || !accountPattern.test(accountId ?? '') || !Number.isFinite(Date.parse(observedAt))) throw fail();
      const result = await rows('meta_ads_v1.worker_activate_selected_account', [
        `\\x${selectionHandleDigest.toString('hex')}`, userId, storeId, accountId, observedAt,
      ]);
      if (result.length === 0) return null;
      if (result.length !== 1 || !plain(result[0])) throw fail();
      return Object.freeze({
        accountId: result[0].provider_account_id,
        currency: result[0].currency,
        timeZone: result[0].timezone_name,
        connectedAt: result[0].connected_at,
      });
    },

    async expirePendingConnections(observedAt) {
      if (!Number.isFinite(Date.parse(observedAt))) throw fail();
      const result = await one('meta_ads_v1.worker_expire_pending_connections', [observedAt]);
      if (result.completed !== true) throw fail();
    },

    async listActiveAccounts(observedAt = now().toISOString()) {
      if (!Number.isFinite(Date.parse(observedAt))) throw fail();
      const result = await rows('meta_ads_v1.worker_list_active_accounts', [observedAt]);
      if (result.length > 5_000) throw fail();
      const seen = new Set();
      return Object.freeze(result.map((row) => {
        if (!plain(row)) throw fail();
        const storeId = row.store_id ?? row.storeId;
        const connectionId = row.connection_id ?? row.connectionId;
        const accountId = row.provider_account_id ?? row.providerAccountId;
        const currency = row.currency;
        const timeZone = row.timezone_name ?? row.timeZone;
        const key = `${storeId}:${connectionId}:${accountId}`;
        if (!uuidPattern.test(storeId ?? '') || !uuidPattern.test(connectionId ?? '')
          || !accountPattern.test(accountId ?? '') || !/^[A-Z]{3}$/.test(currency ?? '')
          || typeof timeZone !== 'string' || timeZone.length < 1 || timeZone.length > 128
          || seen.has(key)) throw fail();
        try { new Intl.DateTimeFormat('en', { timeZone }); } catch { throw fail(); }
        seen.add(key);
        return Object.freeze({ storeId, connectionId, accountId, currency, timeZone });
      }));
    },

    async disconnectConnection({ connectionId, userId, storeId, now: observedAt }) {
      if (!uuidPattern.test(connectionId ?? '') || !uuidPattern.test(userId ?? '')
        || !uuidPattern.test(storeId ?? '') || !Number.isFinite(Date.parse(observedAt))) throw fail();
      const result = await one('meta_ads_v1.worker_disconnect_connection', [connectionId, userId, storeId, observedAt]);
      if (result.completed !== true) throw fail();
      return Object.freeze({ disconnected: true });
    },

    async readStoreStatus({ userId, storeId, now: observedAt }) {
      if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(storeId ?? '')
        || !Number.isFinite(Date.parse(observedAt))) throw fail();
      const result = await rows('meta_ads_v1.worker_read_store_status', [userId, storeId, observedAt]);
      if (result.length > 100) throw fail();
      const seen = new Set();
      const connections = result.map((row) => {
        const value = statusRow(row);
        if (seen.has(value.connectionId)) throw fail();
        seen.add(value.connectionId);
        return value;
      });
      return Object.freeze(connections);
    },

    async beginRun(input) {
      if (!plain(input) || !uuidPattern.test(input.storeId ?? '') || !uuidPattern.test(input.connectionId ?? '')
        || !accountPattern.test(input.accountId ?? '') || !idempotencyPattern.test(input.idempotencyKey ?? '')
        || !Number.isFinite(Date.parse(input.startedAt)) || !Number.isFinite(Date.parse(input.requestedFrom))
        || !Number.isFinite(Date.parse(input.requestedTo)) || !versionPattern.test(input.apiVersion ?? '')) throw fail();
      const result = await one('meta_ads_v1.worker_begin_collection_run', [
        input.idempotencyKey, input.storeId, input.connectionId, input.accountId, input.requestedFrom,
        input.requestedTo, input.currency, input.timeZone, input.apiVersion, input.startedAt,
      ]);
      const runId = result.run_id ?? result.runId;
      if (typeof runId !== 'string' || !uuidPattern.test(runId)) throw fail();
      return Object.freeze({
        runId,
        alreadyComplete: result.already_complete === true,
        alreadyRunning: result.already_running === true,
        claimed: result.claimed === true,
      });
    },

    async completeRun(input) {
      if (!plain(input) || !uuidPattern.test(input.runId ?? '') || !idempotencyPattern.test(input.idempotencyKey ?? '')
        || !plain(input.source) || !Array.isArray(input.coverage) || !Number.isFinite(Date.parse(input.observedAt))
        || !Number.isInteger(input.pagesRead) || !allowedRuns.has(input.status) || !['complete','partial'].includes(input.status)) throw fail();
      const coverage = validateCoverage(input.coverage, input.requestedFrom, input.requestedTo);
      const hasMissing = coverage.some((day) => day.coverageState !== 'provider_row');
      if ((input.status === 'partial') !== hasMissing) throw fail();
      if (input.source.provider !== 'meta_ads' || input.source.accountId === undefined
        || !accountPattern.test(input.source.accountId) || !uuidPattern.test(input.source.storeId ?? '')
        || !uuidPattern.test(input.source.connectionId ?? '') || !/^[A-Z]{3}$/.test(input.source.currency ?? '')
        || typeof input.source.timeZone !== 'string' || !versionPattern.test(input.source.apiVersion ?? '')
        || !Number.isInteger(input.pagesRead) || input.pagesRead < 1 || input.pagesRead > 100) throw fail();
      const result = await one('meta_ads_v1.worker_complete_collection_run', [
        input.runId,
        input.idempotencyKey,
        input.status,
        input.requestedFrom,
        input.requestedTo,
        input.observedAt,
        input.pagesRead,
        objectJson(input.source),
        objectJson(coverage),
      ]);
      if (result.completed !== true) throw fail();
    },

    async failRun({ runId, safeFailure, finishedAt }) {
      if (!uuidPattern.test(runId ?? '') || !['token_expired','access_revoked','provider_unavailable','invalid_response','scope_missing'].includes(safeFailure)
        || !Number.isFinite(Date.parse(finishedAt))) throw fail();
      const result = await one('meta_ads_v1.worker_fail_collection_run', [runId, safeFailure, finishedAt]);
      if (result.completed !== true) throw fail();
    },
  });

  const credentialProvider = Object.freeze({
    async getSelectedAccount({ storeId, connectionId, accountId }) {
      if (!uuidPattern.test(storeId ?? '') || !uuidPattern.test(connectionId ?? '') || !accountPattern.test(accountId ?? '')) throw fail();
      const result = await one('meta_ads_v1.worker_get_selected_account', [storeId, connectionId, accountId]);
      if (result.provider_account_id !== accountId || result.store_id !== storeId || result.connection_id !== connectionId
        || result.active !== true || !/^[A-Z]{3}$/.test(result.currency ?? '') || typeof result.timezone_name !== 'string') throw fail();
      return Object.freeze({ provider: 'meta_ads', accountId, currency: result.currency, timeZone: result.timezone_name, apiVersion });
    },

    async getAccessToken({ storeId, connectionId, accountId }) {
      if (!uuidPattern.test(storeId ?? '') || !uuidPattern.test(connectionId ?? '') || !accountPattern.test(accountId ?? '')) throw fail();
      const result = await one('meta_ads_v1.worker_get_credential_envelope', [storeId, connectionId, accountId]);
      const returnedStore = result.store_id ?? result.storeId;
      const returnedConnection = result.connection_id ?? result.connectionId;
      const returnedAccount = result.provider_account_id ?? result.providerAccountId;
      const expiresAt = result.token_expires_at ?? result.tokenExpiresAt;
      if (returnedStore !== storeId || returnedConnection !== connectionId || returnedAccount !== accountId
        || result.active !== true || !Number.isFinite(Date.parse(expiresAt))) throw fail();
      const accessToken = credentialEnvelope.decrypt({
        connectionId,
        storeId,
        ciphertext: decodeBytea(result.ciphertext),
        encryptedDek: decodeBytea(result.encrypted_dek ?? result.encryptedDek),
        storedKeyVersion: result.key_version ?? result.keyVersion,
        storedAlgorithm: result.algorithm,
      });
      const instant = now();
      if (!(instant instanceof Date) || !Number.isFinite(instant.valueOf()) || Date.parse(expiresAt) <= instant.valueOf()) throw fail();
      return Object.freeze({ accessToken, tokenExpiresAt: new Date(expiresAt).toISOString() });
    },
  });

  return Object.freeze({ repository, credentialProvider });
}

const apiRepositoryMethods = Object.freeze([
  'createOAuthState',
  'consumeOAuthState',
  'createPendingConnection',
  'readPendingSelection',
  'cancelPendingSelection',
  'activateSelectedAccount',
  'disconnectConnection',
  'readStoreStatus',
]);
const collectorRepositoryMethods = Object.freeze([
  'expirePendingConnections',
  'listActiveAccounts',
  'beginRun',
  'completeRun',
  'failRun',
]);

function selectMethods(repository, names) {
  return Object.freeze(Object.fromEntries(names.map((name) => [name, repository[name]])));
}

/** API-only persistence surface; collector RPCs are not exposed here. */
export function createMetaAdsApiRepository(options) {
  const { repository } = createMetaAdsRepository(options);
  return selectMethods(repository, apiRepositoryMethods);
}

/** Collector-only persistence surface, separated from merchant OAuth methods. */
export function createMetaAdsCollectorRepository(options) {
  const { repository, credentialProvider } = createMetaAdsRepository(options);
  return Object.freeze({
    repository: selectMethods(repository, collectorRepositoryMethods),
    credentialProvider,
  });
}
