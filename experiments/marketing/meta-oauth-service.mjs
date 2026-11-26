import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createMetaOAuthState } from './meta-oauth-protocol.mjs';
import { discoverMetaAdAccounts } from './meta-spend-reader.mjs';

const unavailable = () => new Error('Meta Ads connection unavailable');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accountPattern = /^\d{5,32}$/;
const opaquePattern = /^[A-Za-z0-9_-]{32,512}$/;
const MAX_ACCOUNTS = 5_000;
const STATE_TTL_MS = 10 * 60_000;
const SELECTION_TTL_MS = 15 * 60_000;

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function validIdentity(identity) {
  return plainObject(identity) && typeof identity.userId === 'string'
    && uuidPattern.test(identity.userId) && identity.isOwner === true;
}

function digest(value) {
  return createHash('sha256').update(value).digest();
}

function validCode(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 4096
    && /^[A-Za-z0-9._~-]+$/.test(value);
}

function validateAccounts(accounts) {
  if (!Array.isArray(accounts) || accounts.length < 1 || accounts.length > MAX_ACCOUNTS) throw unavailable();
  const seen = new Set();
  const output = [];
  for (const account of accounts) {
    if (!plainObject(account) || !accountPattern.test(account.accountId ?? '')
      || !/^[A-Z]{3}$/.test(account.currency ?? '')
      || typeof account.timeZone !== 'string' || account.timeZone.length < 1 || account.timeZone.length > 128
      || seen.has(account.accountId)) throw unavailable();
    seen.add(account.accountId);
    output.push(Object.freeze({
      accountId: account.accountId,
      currency: account.currency,
      timeZone: account.timeZone,
    }));
  }
  return Object.freeze(output);
}

function validEnvelope(envelope) {
  return plainObject(envelope) && Buffer.isBuffer(envelope.ciphertext)
    && envelope.ciphertext.length >= 1 && envelope.ciphertext.length <= 16_384
    && Buffer.isBuffer(envelope.encryptedDek) && envelope.encryptedDek.length >= 1
    && envelope.encryptedDek.length <= 16_384 && envelope.algorithm === 'AES-256-GCM'
    && typeof envelope.keyVersion === 'string' && envelope.keyVersion.length <= 128
    && Number.isFinite(Date.parse(envelope.tokenExpiresAt));
}

/**
 * Orchestrates OAuth without providing persistence itself. `repository` must
 * implement durable, atomic and owner/store-bound operations; do not replace it
 * with process memory in a deployed service.
 *
 * Required repository operations:
 * - createOAuthState({stateDigest,userId,storeId,expiresAt})
 * - consumeOAuthState({stateDigest,now}) -> {userId,storeId}|null (atomic, once)
 * - createPendingConnection({connectionId,userId,storeId,grantedScope,tokenExpiresAt,
 *   encryptedCredential,accounts,selectionHandleDigest,selectionExpiresAt})
 *   -> {created:boolean}; atomic; retain encrypted token and discovered accounts
 *   only for the short selection lifetime; store only the selection digest.
 * - readPendingSelection({selectionHandleDigest,userId,storeId,now})
 *   -> {accounts,expiresAt}|null; select only an unexpired matching pending
 *   handle and never return credential-envelope fields.
 * - cancelPendingSelection({selectionHandleDigest,userId,storeId,now})
 *   -> {cancelled:boolean}; atomically delete only the matching unexpired
 *   pending connection and its encrypted credential; never delete active or
 *   historical collection evidence.
 * - activateSelectedAccount({selectionHandleDigest,userId,storeId,accountId,now})
 *   -> {accountId,currency,timeZone,connectedAt}|null; atomically verify the
 *   chosen account was discovered in that grant, consume selection, select that
 *   account and activate its connection.
 * - disconnectConnection({userId,storeId,connectionId,now}) ->
 *   {disconnected:boolean}; atomically delete the encrypted credential,
 *   deactivate linked ad accounts, transition connection status, and preserve
 *   historical spend observations.
 * - readStoreStatus({userId,storeId,now}) -> safe connection/run metadata only.
 *
 * These ports must be implemented with fixed RPCs/transactions, never direct
 * browser table writes. Matching fixed RPC proposals now exist, but remain
 * unapplied and require independent review plus a provisioned restricted worker
 * login before this runtime is connected.
 */
export function createMetaOAuthService({
  protocol,
  credentialEnvelope,
  repository,
  authorizeOwner,
  apiVersion,
  fetchImpl = fetch,
  now = () => new Date(),
}) {
  if (!protocol || typeof protocol.authorizationUrl !== 'function'
    || typeof protocol.exchangeCode !== 'function'
    || typeof protocol.exchangeForLongLivedToken !== 'function'
    || typeof protocol.assertAdsReadGranted !== 'function'
    || !credentialEnvelope || typeof credentialEnvelope.encrypt !== 'function'
    || !repository || typeof authorizeOwner !== 'function'
    || !/^v\d+\.\d+$/.test(apiVersion ?? '') || typeof fetchImpl !== 'function'
    || typeof now !== 'function') throw unavailable();
  for (const method of ['createOAuthState','consumeOAuthState','createPendingConnection','readPendingSelection','cancelPendingSelection','activateSelectedAccount','disconnectConnection','readStoreStatus']) {
    if (typeof repository[method] !== 'function') throw unavailable();
  }

  async function assertOwner(userId, storeId) {
    let allowed = false;
    try { allowed = await authorizeOwner({ userId, storeId }) === true; } catch { throw unavailable(); }
    if (!allowed) throw unavailable();
  }

  function currentDate() {
    const value = now();
    if (!(value instanceof Date) || !Number.isFinite(value.valueOf())) throw unavailable();
    return value;
  }

  async function consumeState(state) {
    if (!opaquePattern.test(state ?? '')) throw unavailable();
    let result;
    try { result = await repository.consumeOAuthState({ stateDigest: digest(state), now: currentDate().toISOString() }); }
    catch { throw unavailable(); }
    if (!plainObject(result) || !uuidPattern.test(result.userId ?? '') || !uuidPattern.test(result.storeId ?? '')) throw unavailable();
    await assertOwner(result.userId, result.storeId);
    return Object.freeze({ userId: result.userId, storeId: result.storeId });
  }

  return Object.freeze({
    /** Called only after the API route authenticated the current owner. */
    async start(identity, { storeId } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      const { state, digest: stateDigest } = createMetaOAuthState();
      const expiresAt = new Date(currentDate().valueOf() + STATE_TTL_MS).toISOString();
      try {
        await repository.createOAuthState({ stateDigest, userId: identity.userId, storeId, expiresAt });
      } catch { throw unavailable(); }
      return Object.freeze({ url: protocol.authorizationUrl(state) });
    },

    /** OAuth callback path. Tokens remain server-side and are encrypted before persistence. */
    async complete({ state, code } = {}) {
      if (!validCode(code)) throw unavailable();
      const binding = await consumeState(state);
      let shortToken;
      let longToken;
      try {
        shortToken = await protocol.exchangeCode(code);
        if (!shortToken || typeof shortToken.accessToken !== 'string'
          || !Number.isSafeInteger(shortToken.expiresInSeconds)) throw unavailable();
        await protocol.assertAdsReadGranted(shortToken.accessToken);
        longToken = await protocol.exchangeForLongLivedToken(shortToken.accessToken);
        if (!longToken || typeof longToken.accessToken !== 'string'
          || !Number.isSafeInteger(longToken.expiresInSeconds)
          || !Number.isFinite(Date.parse(longToken.expiresAt))
          || Date.parse(longToken.expiresAt) <= currentDate().valueOf()) throw unavailable();
        await protocol.assertAdsReadGranted(longToken.accessToken);
        const discovered = await discoverMetaAdAccounts({
          accessToken: longToken.accessToken,
          apiVersion,
          fetchImpl,
        });
        const accounts = validateAccounts(discovered.accounts);
        const connectionId = randomUUID();
        const selectionHandle = randomBytes(32).toString('base64url');
        const tokenExpiresAt = new Date(longToken.expiresAt).toISOString();
        const encryptedCredential = credentialEnvelope.encrypt({
          connectionId,
          storeId: binding.storeId,
          accessToken: longToken.accessToken,
          expiresAt: tokenExpiresAt,
        });
        if (!validEnvelope(encryptedCredential)) throw unavailable();
        const selectionExpiresAt = new Date(currentDate().valueOf() + SELECTION_TTL_MS).toISOString();
        let result;
        try {
          result = await repository.createPendingConnection({
            connectionId,
            userId: binding.userId,
            storeId: binding.storeId,
            grantedScope: Object.freeze(['ads_read']),
            tokenExpiresAt,
            encryptedCredential,
            accounts,
            selectionHandleDigest: digest(selectionHandle),
            selectionExpiresAt,
          });
        } catch { throw unavailable(); }
        if (!plainObject(result) || result.created !== true) throw unavailable();
        return Object.freeze({
          status: 'account_selection_required',
          selectionHandle,
          accounts,
          expiresAt: selectionExpiresAt,
        });
      } catch {
        throw unavailable();
      } finally {
        // JS strings cannot be reliably zeroed; keep these references scoped to
        // this callback and never log, return, cache or attach them to errors.
        shortToken = undefined;
        longToken = undefined;
      }
    },

    /** Consume a declined/cancelled consent callback without trusting its text. */
    async deny({ state } = {}) {
      await consumeState(state);
      return Object.freeze({ status: 'cancelled' });
    },

    /** Authenticated Settings read: expose only the still-valid account choices. */
    async readSelection(identity, { storeId, selectionHandle } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')
        || !opaquePattern.test(selectionHandle ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      let pending;
      try {
        pending = await repository.readPendingSelection({
          selectionHandleDigest: digest(selectionHandle),
          userId: identity.userId,
          storeId,
          now: currentDate().toISOString(),
        });
      } catch { throw unavailable(); }
      if (!plainObject(pending) || !Number.isFinite(Date.parse(pending.expiresAt))
        || Date.parse(pending.expiresAt) <= currentDate().valueOf()) throw unavailable();
      const accounts = validateAccounts(pending.accounts);
      return Object.freeze({ status: 'selection_required', accounts, expiresAt: pending.expiresAt });
    },

    /** Delete the short-lived pending credential immediately when the owner cancels. */
    async cancelPendingSelection(identity, { storeId, selectionHandle } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')
        || !opaquePattern.test(selectionHandle ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      let result;
      try {
        result = await repository.cancelPendingSelection({
          selectionHandleDigest: digest(selectionHandle),
          userId: identity.userId,
          storeId,
          now: currentDate().toISOString(),
        });
      } catch { throw unavailable(); }
      if (!plainObject(result) || result.cancelled !== true) throw unavailable();
      return Object.freeze({ status: 'cancelled' });
    },

    /** The user must choose from the exact account list discovered in this grant. */
    async selectAccount(identity, { storeId, selectionHandle, accountId } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')
        || !opaquePattern.test(selectionHandle ?? '') || !accountPattern.test(accountId ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      let result;
      try {
        result = await repository.activateSelectedAccount({
          selectionHandleDigest: digest(selectionHandle),
          userId: identity.userId,
          storeId,
          accountId,
          now: currentDate().toISOString(),
        });
      } catch { throw unavailable(); }
      if (!plainObject(result) || result.accountId !== accountId
        || !/^[A-Z]{3}$/.test(result.currency ?? '')
        || typeof result.timeZone !== 'string' || result.timeZone.length < 1 || result.timeZone.length > 128
        || !Number.isFinite(Date.parse(result.connectedAt))) throw unavailable();
      return Object.freeze({
        status: 'connected',
        accountId: result.accountId,
        currency: result.currency,
        timeZone: result.timeZone,
        connectedAt: result.connectedAt,
      });
    },

    /** Remove Meta access while retaining spend observations for the audit history. */
    async disconnect(identity, { storeId, connectionId } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')
        || !uuidPattern.test(connectionId ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      let result;
      try {
        result = await repository.disconnectConnection({
          userId: identity.userId,
          storeId,
          connectionId,
          now: currentDate().toISOString(),
        });
      } catch { throw unavailable(); }
      if (!plainObject(result) || result.disconnected !== true) throw unavailable();
      return Object.freeze({ status: 'disconnected' });
    },

    /** Authenticated Settings read; the projection contains no token material or OAuth state. */
    async readStatus(identity, { storeId } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      let rows;
      try {
        rows = await repository.readStoreStatus({
          userId: identity.userId,
          storeId,
          now: currentDate().toISOString(),
        });
      } catch { throw unavailable(); }
      if (!Array.isArray(rows) || rows.length > 100) throw unavailable();
      const connections = rows.map((row) => {
        if (!plainObject(row) || !uuidPattern.test(row.connectionId ?? '')
          || !['pending','connected','reauthorization_required','disconnected','revoked'].includes(row.status)
          || (row.accountId !== null && !accountPattern.test(row.accountId ?? ''))
          || (row.currency !== null && !/^[A-Z]{3}$/.test(row.currency ?? ''))
          || (row.timeZone !== null && (typeof row.timeZone !== 'string' || row.timeZone.length < 1 || row.timeZone.length > 128))
          || ![null, undefined].includes(row.connectedAt) && !Number.isFinite(Date.parse(row.connectedAt))
          || ![null, undefined].includes(row.disconnectedAt) && !Number.isFinite(Date.parse(row.disconnectedAt))
          || ![null, undefined].includes(row.tokenExpiresAt) && !Number.isFinite(Date.parse(row.tokenExpiresAt))) throw unavailable();
        let latestRun = null;
        if (row.latestRun !== null) {
          const run = row.latestRun;
          if (!plainObject(run) || !uuidPattern.test(run.runId ?? '')
            || !['running','complete','partial','failed'].includes(run.status)
            || !Number.isFinite(Date.parse(run.startedAt))
            || ![null, undefined].includes(run.finishedAt) && !Number.isFinite(Date.parse(run.finishedAt))
            || typeof run.from !== 'string' || typeof run.to !== 'string'
            || !/^\d{4}-\d{2}-\d{2}$/.test(run.from) || !/^\d{4}-\d{2}-\d{2}$/.test(run.to)
            || (run.safeFailure !== null && !['token_expired','access_revoked','provider_unavailable','invalid_response','scope_missing'].includes(run.safeFailure))
            || !Number.isInteger(run.pagesRead) || run.pagesRead < 0 || run.pagesRead > 100) throw unavailable();
          latestRun = Object.freeze({
            runId: run.runId,
            status: run.status,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            from: run.from,
            to: run.to,
            safeFailure: run.safeFailure,
            pagesRead: run.pagesRead,
          });
        }
        return Object.freeze({
          connectionId: row.connectionId,
          status: row.status,
          connectedAt: row.connectedAt,
          disconnectedAt: row.disconnectedAt,
          tokenExpiresAt: row.tokenExpiresAt,
          accountId: row.accountId,
          currency: row.currency,
          timeZone: row.timeZone,
          latestRun,
        });
      });
      return Object.freeze({ status: 'available', connections: Object.freeze(connections) });
    },

  });
}
