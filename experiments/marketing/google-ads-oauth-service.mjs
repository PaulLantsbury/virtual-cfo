import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createGoogleAdsOAuthState } from './google-ads-oauth-protocol.mjs';
import {
  inspectGoogleAdsDirectCustomer,
  listGoogleAdsDirectCustomerIds,
  listGoogleAdsManagerAdvertisers,
  readGoogleAdsCustomerMetadata,
} from './google-ads-account-discovery.mjs';

const unavailable = () => new Error('Google Ads connection unavailable');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const customerIdPattern = /^\d{10}$/;
const opaquePattern = /^[A-Za-z0-9_-]{43}$/;
const maxCustomers = 5_000;
const maxDirectCustomers = 500;
const stateTtlMs = 10 * 60_000;
const selectionTtlMs = 15 * 60_000;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

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
    && /^[A-Za-z0-9._~+\-/=]+$/.test(value);
}

function validateAccountSelections(selections) {
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > maxCustomers) throw unavailable();
  const seen = new Set();
  const output = [];
  for (const selection of selections) {
    if (!plainObject(selection) || !customerIdPattern.test(selection.customerId ?? '')
      || (selection.loginCustomerId !== null && !customerIdPattern.test(selection.loginCustomerId ?? ''))
      || selection.customerId === selection.loginCustomerId) throw unavailable();
    const key = `${selection.loginCustomerId ?? ''}:${selection.customerId}`;
    if (seen.has(key)) throw unavailable();
    seen.add(key);
    output.push(Object.freeze({ customerId: selection.customerId, loginCustomerId: selection.loginCustomerId ?? null }));
  }
  return Object.freeze(output.sort((a, b) => `${a.loginCustomerId ?? ''}:${a.customerId}`.localeCompare(`${b.loginCustomerId ?? ''}:${b.customerId}`)));
}

export async function discoverGoogleAdsAccountSelections({ accessToken, fetchImpl = fetch }) {
  const direct = await listGoogleAdsDirectCustomerIds({ accessToken, fetchImpl });
  if (!Array.isArray(direct.customerIds) || direct.customerIds.length > maxDirectCustomers) throw unavailable();
  const accountSelections = [];
  for (const directCustomerId of direct.customerIds) {
    const inspected = await inspectGoogleAdsDirectCustomer({
      accessToken,
      customerId: directCustomerId,
      directlyAccessibleCustomerIds: direct.customerIds,
      fetchImpl,
    });
    if (inspected.isManager) {
      const manager = await listGoogleAdsManagerAdvertisers({ accessToken, managerCustomerId: directCustomerId, fetchImpl });
      accountSelections.push(...manager.advertisers.map(({ customerId, loginCustomerId }) => ({ customerId, loginCustomerId })));
    } else {
      accountSelections.push({ customerId: directCustomerId, loginCustomerId: null });
    }
  }
  return Object.freeze({ accountSelections: validateAccountSelections(accountSelections) });
}

function validEnvelope(envelope) {
  return plainObject(envelope) && Buffer.isBuffer(envelope.ciphertext)
    && envelope.ciphertext.length >= 1 && envelope.ciphertext.length <= 16_384
    && Buffer.isBuffer(envelope.encryptedDek) && envelope.encryptedDek.length >= 1
    && envelope.encryptedDek.length <= 16_384 && envelope.algorithm === 'AES-256-GCM'
    && typeof envelope.keyVersion === 'string' && envelope.keyVersion.length <= 128;
}

/**
 * Orchestrates server-side Google Ads OAuth. Never return refresh/access tokens
 * to a browser. The repository must implement all state/selection operations
 * as fixed, user/store-bound atomic RPCs and keep connection secrets inaccessible
 * to ordinary browser/database roles.
 *
 * Required repository operations:
 * - createOAuthState({stateDigest,userId,storeId,expiresAt})
 * - consumeOAuthState({stateDigest,now}) -> {userId,storeId}|null (atomic once)
 * - createPendingConnection({connectionId,userId,storeId,grantedScopes,
 *   encryptedCredential,accountSelections,oauthAppPublishingStatus,
 *   selectionHandleDigest,selectionExpiresAt})
 *   -> {created:boolean}; retain the encrypted refresh token only during the
 *   short account-selection lifetime; persist only the selection digest.
 * - readPendingCredential({selectionHandleDigest,userId,storeId,now})
 *   -> {connectionId,ciphertext,encryptedDek,algorithm,keyVersion,accountSelections,selectionExpiresAt}|null;
 *   only return an unexpired record bound to this owner/store/one-use handle.
 * - activateSelectedAccount({selectionHandleDigest,userId,storeId,customerId,
 *   loginCustomerId,currency,timeZone,now}) -> {customerId,loginCustomerId,
 *   currency,timeZone,connectedAt}|null;
 *   atomically select only an exact account pair from the
 *   discovered list and activate the pending connection.
 * - disconnectConnection({userId,storeId,connectionId,now}) -> {disconnected:boolean}
 * - readStoreStatus({userId,storeId,now}) -> safe connection metadata only
 *
 * `credentialEnvelope.encrypt` must bind authenticated encryption to both IDs
 * and return the same envelope shape used by the Google storage proposal.
 */
export function createGoogleAdsOAuthService({
  protocol,
  credentialEnvelope,
  repository,
  authorizeOwner,
  pkceKey,
  apiVersion = 'v26',
  discoverAccounts = discoverGoogleAdsAccountSelections,
  // The database records this status and schedules re-consent by day 6 for
  // Testing apps because Google expires Ads-scope refresh tokens after day 7.
  oauthAppPublishingStatus = 'testing',
  fetchImpl = fetch,
  now = () => new Date(),
}) {
  if (!protocol || typeof protocol.authorizationUrl !== 'function' || typeof protocol.exchangeCode !== 'function'
    || typeof protocol.refreshAccessToken !== 'function'
    || !credentialEnvelope || typeof credentialEnvelope.encrypt !== 'function' || typeof credentialEnvelope.decrypt !== 'function'
    || !repository || typeof authorizeOwner !== 'function'
    || typeof pkceKey !== 'string' && !Buffer.isBuffer(pkceKey)
    || Buffer.byteLength(pkceKey) < 32 || Buffer.byteLength(pkceKey) > 4096
    || apiVersion !== 'v26' || typeof discoverAccounts !== 'function'
    || !['testing', 'production'].includes(oauthAppPublishingStatus)
    || typeof fetchImpl !== 'function' || typeof now !== 'function') throw unavailable();
  for (const method of ['createOAuthState', 'consumeOAuthState', 'createPendingConnection', 'readPendingCredential',
    'activateSelectedAccount', 'disconnectConnection', 'readStoreStatus']) {
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
    let binding;
    try {
      binding = await repository.consumeOAuthState({ stateDigest: digest(state), now: currentDate().toISOString() });
    } catch { throw unavailable(); }
    if (!plainObject(binding) || !uuidPattern.test(binding.userId ?? '') || !uuidPattern.test(binding.storeId ?? '')) throw unavailable();
    await assertOwner(binding.userId, binding.storeId);
    return Object.freeze({ userId: binding.userId, storeId: binding.storeId });
  }

  return Object.freeze({
    /** Called after the existing API route authenticates the current store owner. */
    async start(identity, { storeId } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      const { state, stateDigest } = createGoogleAdsOAuthState();
      const expiresAt = new Date(currentDate().valueOf() + stateTtlMs).toISOString();
      try { await repository.createOAuthState({ stateDigest, userId: identity.userId, storeId, expiresAt }); }
      catch { throw unavailable(); }
      return Object.freeze({ url: protocol.authorizationUrl(state, pkceKey) });
    },

    /** OAuth callback. Persist only encrypted refresh-token material server-side. */
    async complete({ state, code } = {}) {
      if (!validCode(code) || !opaquePattern.test(state ?? '')) throw unavailable();
      const binding = await consumeState(state);
      let tokenSet;
      try {
        tokenSet = await protocol.exchangeCode(code, state, pkceKey);
        if (!tokenSet || typeof tokenSet.refreshToken !== 'string'
          || tokenSet.refreshToken.length < 16 || tokenSet.refreshToken.length > 16_384
          || typeof tokenSet.accessToken !== 'string' || !Array.isArray(tokenSet.grantedScopes)
          || tokenSet.grantedScopes.length !== 1
          || tokenSet.grantedScopes[0] !== 'https://www.googleapis.com/auth/adwords') throw unavailable();
        const discovered = await discoverAccounts({ accessToken: tokenSet.accessToken, apiVersion, fetchImpl });
        const accountSelections = validateAccountSelections(discovered?.accountSelections);
        const connectionId = randomUUID();
        const selectionHandle = randomBytes(32).toString('base64url');
        const encryptedCredential = credentialEnvelope.encrypt({
          connectionId,
          storeId: binding.storeId,
          refreshToken: tokenSet.refreshToken,
        });
        if (!validEnvelope(encryptedCredential)) throw unavailable();
        const selectionExpiresAt = new Date(currentDate().valueOf() + selectionTtlMs).toISOString();
        let result;
        try {
          result = await repository.createPendingConnection({
            connectionId,
            userId: binding.userId,
            storeId: binding.storeId,
            grantedScopes: Object.freeze(['https://www.googleapis.com/auth/adwords']),
            encryptedCredential,
            accountSelections,
            oauthAppPublishingStatus,
            selectionHandleDigest: digest(selectionHandle),
            selectionExpiresAt,
          });
        } catch { throw unavailable(); }
        if (!plainObject(result) || result.created !== true) throw unavailable();
        return Object.freeze({
          status: 'account_selection_required',
          selectionHandle,
          accounts: accountSelections,
          expiresAt: selectionExpiresAt,
        });
      } catch {
        throw unavailable();
      } finally {
        // JavaScript strings cannot be reliably zeroed. Keep them callback-scoped;
        // never log, return, cache or attach token material to errors.
        tokenSet = undefined;
      }
    },

    /** Consume a denied/cancelled callback without trusting the provider's text. */
    async deny({ state } = {}) {
      await consumeState(state);
      return Object.freeze({ status: 'cancelled' });
    },

    /** Read only the account IDs offered for a pending selection. The route
     * receives no credential envelope and this method never decrypts it. */
    async readAccountSelections(identity, { storeId, selectionHandle } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')
        || !opaquePattern.test(selectionHandle ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      let pending;
      try {
        pending = await repository.readPendingCredential({
          selectionHandleDigest: digest(selectionHandle),
          userId: identity.userId,
          storeId,
          now: currentDate().toISOString(),
        });
      } catch { throw unavailable(); }
      if (!plainObject(pending) || !Number.isFinite(Date.parse(pending.selectionExpiresAt))
        || Date.parse(pending.selectionExpiresAt) <= currentDate().valueOf()) throw unavailable();
      const accounts = validateAccountSelections(pending.accountSelections);
      return Object.freeze({
        status: 'account_selection_required',
        accounts,
        expiresAt: new Date(pending.selectionExpiresAt).toISOString(),
      });
    },

    /** Select only an account discovered under this consent and pending handle. */
    async selectAccount(identity, { storeId, selectionHandle, customerId, loginCustomerId = null } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')
        || !opaquePattern.test(selectionHandle ?? '') || !customerIdPattern.test(customerId ?? '')
        || (loginCustomerId !== null && !customerIdPattern.test(loginCustomerId ?? ''))
        || customerId === loginCustomerId) throw unavailable();
      await assertOwner(identity.userId, storeId);
      let pending;
      try {
        pending = await repository.readPendingCredential({
          selectionHandleDigest: digest(selectionHandle),
          userId: identity.userId,
          storeId,
          now: currentDate().toISOString(),
        });
      } catch { throw unavailable(); }
      if (!plainObject(pending) || !uuidPattern.test(pending.connectionId ?? '')
        || !Buffer.isBuffer(pending.ciphertext) || !Buffer.isBuffer(pending.encryptedDek)
        || pending.ciphertext.length < 30 || pending.ciphertext.length > 16_384
        || pending.encryptedDek.length < 30 || pending.encryptedDek.length > 16_384
        || pending.algorithm !== 'AES-256-GCM' || typeof pending.keyVersion !== 'string'
        || !Number.isFinite(Date.parse(pending.selectionExpiresAt))
        || Date.parse(pending.selectionExpiresAt) <= currentDate().valueOf()) throw unavailable();
      const pendingSelections = validateAccountSelections(pending.accountSelections);
      if (!pendingSelections.some((item) => item.customerId === customerId
        && item.loginCustomerId === loginCustomerId)) throw unavailable();

      let refreshToken;
      let accessToken;
      try {
        refreshToken = credentialEnvelope.decrypt({
          connectionId: pending.connectionId,
          storeId,
          ciphertext: pending.ciphertext,
          encryptedDek: pending.encryptedDek,
          storedAlgorithm: pending.algorithm,
          storedKeyVersion: pending.keyVersion,
        });
        if (typeof refreshToken !== 'string' || refreshToken.length < 16 || refreshToken.length > 16_384) throw unavailable();
        const tokenSet = await protocol.refreshAccessToken(refreshToken);
        if (!tokenSet || typeof tokenSet.accessToken !== 'string' || !Array.isArray(tokenSet.grantedScopes)
          || tokenSet.grantedScopes.length !== 1
          || tokenSet.grantedScopes[0] !== 'https://www.googleapis.com/auth/adwords') throw unavailable();
        accessToken = tokenSet.accessToken;
        const metadata = await readGoogleAdsCustomerMetadata({ accessToken, customerId, loginCustomerId, fetchImpl });
        if (!plainObject(metadata) || metadata.customerId !== customerId
          || !/^[A-Z]{3}$/.test(metadata.currency ?? '')
          || typeof metadata.timeZone !== 'string' || metadata.timeZone.length < 1 || metadata.timeZone.length > 128) throw unavailable();
        let result;
        try {
          result = await repository.activateSelectedAccount({
            selectionHandleDigest: digest(selectionHandle),
            userId: identity.userId,
            storeId,
            customerId,
            loginCustomerId,
            currency: metadata.currency,
            timeZone: metadata.timeZone,
            now: currentDate().toISOString(),
          });
        } catch { throw unavailable(); }
        if (!plainObject(result) || result.customerId !== customerId || (result.loginCustomerId ?? null) !== loginCustomerId
          || result.currency !== metadata.currency || result.timeZone !== metadata.timeZone
          || !Number.isFinite(Date.parse(result.connectedAt))) throw unavailable();
        return Object.freeze({
          status: 'connected', customerId, loginCustomerId,
          currency: result.currency, timeZone: result.timeZone, connectedAt: result.connectedAt,
        });
      } catch { throw unavailable(); }
      finally {
        // Avoid retaining plaintext credentials beyond this selection call.
        refreshToken = undefined;
        accessToken = undefined;
      }
    },

    /** Disconnect and delete the encrypted refresh token, preserving spend history. */
    async disconnect(identity, { storeId, connectionId } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '') || !uuidPattern.test(connectionId ?? '')) throw unavailable();
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

    /** Safe Settings projection. No token, OAuth state, or raw provider error is returned. */
    async readStatus(identity, { storeId } = {}) {
      if (!validIdentity(identity) || !uuidPattern.test(storeId ?? '')) throw unavailable();
      await assertOwner(identity.userId, storeId);
      let rows;
      try {
        rows = await repository.readStoreStatus({ userId: identity.userId, storeId, now: currentDate().toISOString() });
      } catch { throw unavailable(); }
      if (!Array.isArray(rows) || rows.length > 100) throw unavailable();
      const connections = rows.map((row) => {
        if (!plainObject(row) || !uuidPattern.test(row.connectionId ?? '')
          || !['pending', 'connected', 'reauthorization_required', 'disconnected', 'revoked'].includes(row.status)
          || !['testing', 'production'].includes(row.oauthAppPublishingStatus)
          || (row.reauthorizeBy !== null && !Number.isFinite(Date.parse(row.reauthorizeBy)))
          || (row.oauthAppPublishingStatus === 'testing' && row.reauthorizeBy === null)
          || (row.oauthAppPublishingStatus === 'production' && row.reauthorizeBy !== null)
          || (row.customerId !== null && !customerIdPattern.test(row.customerId ?? ''))
          || (row.loginCustomerId !== null && !customerIdPattern.test(row.loginCustomerId ?? ''))
          || (row.currency !== null && !/^[A-Z]{3}$/.test(row.currency ?? ''))
          || (row.timeZone !== null && (typeof row.timeZone !== 'string' || row.timeZone.length < 1 || row.timeZone.length > 128))
          || (row.lastCollectedThrough !== null && !isCalendarDay(row.lastCollectedThrough))
          || (row.updatedAt !== null && !Number.isFinite(Date.parse(row.updatedAt)))) throw unavailable();
        return Object.freeze({
          connectionId: row.connectionId,
          status: row.status,
          oauthAppPublishingStatus: row.oauthAppPublishingStatus,
          reauthorizeBy: row.reauthorizeBy,
          customerId: row.customerId,
          loginCustomerId: row.loginCustomerId ?? null,
          currency: row.currency,
          timeZone: row.timeZone,
          lastCollectedThrough: row.lastCollectedThrough ?? null,
          // Keep collection/update freshness unknown unless the storage RPC
          // returns an explicit value; connection time is not collection time.
          updatedAt: row.updatedAt ?? null,
        });
      });
      return Object.freeze({ provider: 'google_ads', connections: Object.freeze(connections) });
    },
  });
}
