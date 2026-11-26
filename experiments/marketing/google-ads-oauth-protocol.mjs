import { createHash, createHmac, randomBytes } from 'node:crypto';

const authOrigin = 'https://accounts.google.com';
const tokenEndpoint = new URL('https://oauth2.googleapis.com/token');
const oauthScope = 'https://www.googleapis.com/auth/adwords';
const fail = () => new Error('Google Ads connection unavailable');
const statePattern = /^[A-Za-z0-9_-]{43}$/;
const codePattern = /^[A-Za-z0-9._~+\-/=]{8,4096}$/;
const clientIdPattern = /^[A-Za-z0-9_-]{20,256}\.apps\.googleusercontent\.com$/;

function validateConfig(config) {
  if (!config || !clientIdPattern.test(config.clientId ?? '')
    || typeof config.clientSecret !== 'string' || config.clientSecret.length < 8 || config.clientSecret.length > 512
    || typeof config.redirectUri !== 'string' || config.redirectUri.length > 2048) throw fail();
  let callback;
  try { callback = new URL(config.redirectUri); } catch { throw fail(); }
  if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash
    || callback.search || callback.toString() !== config.redirectUri) throw fail();
  return Object.freeze({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: callback.toString(),
  });
}

function validSecret(value) {
  return (typeof value === 'string' || Buffer.isBuffer(value)) && Buffer.byteLength(value) >= 32
    && Buffer.byteLength(value) <= 4096;
}

function stateDigest(state) {
  if (!statePattern.test(state ?? '')) throw fail();
  return createHash('sha256').update(state).digest();
}

/**
 * Creates one high-entropy, single-use state value. The matching PKCE verifier
 * is derived with a server-only key, so it need not be persisted in plaintext.
 * Store only `stateDigest` with the authenticated user/store and a short expiry.
 */
export function createGoogleAdsOAuthState() {
  const state = randomBytes(32).toString('base64url');
  return Object.freeze({ state, stateDigest: createHash('sha256').update(state).digest() });
}

function codeVerifierFor(state, pkceKey) {
  if (!statePattern.test(state ?? '') || !validSecret(pkceKey)) throw fail();
  return createHmac('sha256', pkceKey).update(`night-scout/google-ads/oauth-pkce/v1|${state}`).digest('base64url');
}

function parseScopes(value, { allowUnreported = false } = {}) {
  if (value === undefined && allowUnreported) return Object.freeze([oauthScope]);
  if (typeof value !== 'string' || value.length > 2048) throw fail();
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))].sort();
  if (scopes.length !== 1 || scopes[0] !== oauthScope) throw fail();
  return Object.freeze(scopes);
}

async function readBoundedJson(response, maxBytes) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) throw fail();
  const reader = response.body?.getReader?.();
  if (!reader) throw fail();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw fail();
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw fail();
      }
      chunks.push(value);
    }
  } catch {
    throw fail();
  } finally {
    try { reader.releaseLock(); } catch { /* The stream may already be closed. */ }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail();
    return value;
  } catch {
    throw fail();
  }
}

function validToken(value) {
  return typeof value === 'string' && value.length >= 16 && value.length <= 16_384
    && !/[\r\n]/.test(value);
}

function parseTokenResponse(body, { requireRefreshToken = false, allowUnreportedScope = false } = {}) {
  if (!validToken(body.access_token) || body.token_type?.toLowerCase() !== 'bearer'
    || !Number.isSafeInteger(body.expires_in) || body.expires_in < 60 || body.expires_in > 86_400) throw fail();
  const grantedScopes = parseScopes(body.scope, { allowUnreported: allowUnreportedScope });
  const refreshToken = body.refresh_token === undefined ? null : body.refresh_token;
  if ((requireRefreshToken && !validToken(refreshToken))
    || (refreshToken !== null && !validToken(refreshToken))) throw fail();
  const receivedAt = new Date();
  const expiresAt = new Date(receivedAt.valueOf() + Math.max(30, body.expires_in - 30) * 1000).toISOString();
  return Object.freeze({
    accessToken: body.access_token,
    refreshToken,
    grantedScopes,
    expiresInSeconds: body.expires_in,
    expiresAt,
  });
}

async function postTokenForm(form, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(tokenEndpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw fail(); }
  if (!response?.ok) throw fail();
  return readBoundedJson(response, 64_000);
}

/**
 * Google OAuth web-server protocol. Client credentials are application-level;
 * the refresh token returned for a user is a separate per-connection secret.
 * Never log token endpoint request bodies, response bodies, or authorization URLs.
 */
export function createGoogleAdsOAuthProtocol(config, fetchImpl = fetch) {
  const settings = validateConfig(config);
  if (typeof fetchImpl !== 'function') throw fail();

  return Object.freeze({
    authorizationUrl(state, pkceKey) {
      stateDigest(state);
      const verifier = codeVerifierFor(state, pkceKey);
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const url = new URL('/o/oauth2/v2/auth', authOrigin);
      url.searchParams.set('client_id', settings.clientId);
      url.searchParams.set('redirect_uri', settings.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', oauthScope);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('include_granted_scopes', 'false');
      url.searchParams.set('prompt', 'consent select_account');
      return url.toString();
    },

    /** One-time code exchange; requires a new per-user refresh token. */
    async exchangeCode(code, state, pkceKey) {
      if (typeof code !== 'string' || !codePattern.test(code)) throw fail();
      const verifier = codeVerifierFor(state, pkceKey);
      const body = await postTokenForm({
        code,
        code_verifier: verifier,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        redirect_uri: settings.redirectUri,
        grant_type: 'authorization_code',
      }, fetchImpl);
      return parseTokenResponse(body, { requireRefreshToken: true });
    },

    /** Refresh an access token without changing or returning the stored credential. */
    async refreshAccessToken(refreshToken) {
      if (!validToken(refreshToken)) throw fail();
      const body = await postTokenForm({
        refresh_token: refreshToken,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        grant_type: 'refresh_token',
      }, fetchImpl);
      // RFC 6749 permits the server to omit scope when it is unchanged. The
      // stored refresh token was accepted only for the single Ads scope; if a
      // scope is returned, parseTokenResponse still requires that exact scope.
      const refreshed = parseTokenResponse(body, { allowUnreportedScope: true });
      return Object.freeze({
        accessToken: refreshed.accessToken,
        grantedScopes: refreshed.grantedScopes,
        expiresInSeconds: refreshed.expiresInSeconds,
        expiresAt: refreshed.expiresAt,
      });
    },
  });
}

export const GOOGLE_ADS_OAUTH_SCOPE = oauthScope;
