import { createHash, randomBytes } from 'node:crypto';

const graphOrigin = 'https://graph.facebook.com';
const dialogOrigin = 'https://www.facebook.com';
const fail = () => new Error('Meta Ads connection unavailable');
const versionPattern = /^v\d+\.\d+$/;
const opaquePattern = /^[A-Za-z0-9._~-]{32,512}$/;

function configValue(value, max = 4096) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function validateConfig(config) {
  if (!config || !/^\d{5,32}$/.test(config.appId ?? '')
    || !configValue(config.appSecret, 512)
    || !versionPattern.test(config.apiVersion ?? '')
    || !configValue(config.redirectUri, 2048)) throw fail();
  let callback;
  try { callback = new URL(config.redirectUri); } catch { throw fail(); }
  if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash) throw fail();
  return Object.freeze({
    appId: config.appId,
    appSecret: config.appSecret,
    apiVersion: config.apiVersion,
    redirectUri: callback.toString(),
  });
}

function endpoint(origin, version, path, params) {
  const url = new URL(`/${version}/${path}`, origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

/** Generate a high-entropy state value and its DB-safe digest for one-use storage. */
export function createMetaOAuthState() {
  const state = randomBytes(32).toString('base64url');
  return Object.freeze({ state, digest: createHash('sha256').update(state).digest() });
}

async function readJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw fail(); }
  if (!response?.ok) throw fail();
  let body;
  try {
    const raw = await readBoundedText(response, 64_000);
    body = JSON.parse(raw);
  } catch { throw fail(); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail();
  return body;
}

async function readBoundedText(response, maxBytes) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    try { await response.body?.cancel?.(); } catch { /* Preserve the generic provider error. */ }
    throw fail();
  }
  const reader = response.body?.getReader?.();
  if (!reader) throw fail();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw fail();
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try { await reader.cancel(); } catch { /* Preserve the generic provider error. */ }
        throw fail();
      }
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch { /* Stream may already be closed. */ }
    throw fail();
  } finally {
    try { reader.releaseLock(); } catch { /* Stream may already be closed. */ }
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { throw fail(); }
}

function tokenResponse(body) {
  if (typeof body.access_token !== 'string' || body.access_token.length < 16
    || body.access_token.length > 16_384 || body.token_type?.toLowerCase() !== 'bearer'
    || !Number.isSafeInteger(body.expires_in) || body.expires_in < 60 || body.expires_in > 90 * 86400) {
    throw fail();
  }
  // Conservatively shave 30 seconds off the provider lifetime to cover network
  // and clock drift between token issuance and receipt by this server.
  const receivedAt = new Date();
  const expiresAt = new Date(receivedAt.valueOf() + Math.max(30, body.expires_in - 30) * 1000).toISOString();
  return Object.freeze({ accessToken: body.access_token, expiresInSeconds: body.expires_in, expiresAt });
}

/**
 * Server-side OAuth protocol only. Caller must authenticate the owner, bind
 * state to that user/store, atomically consume it once, encrypt the returned
 * token immediately, and never return tokens to the browser or log requests.
 */
export function createMetaOAuthProtocol(config, fetchImpl = fetch) {
  const settings = validateConfig(config);
  if (typeof fetchImpl !== 'function') throw fail();

  return Object.freeze({
    authorizationUrl(state) {
      if (!opaquePattern.test(state ?? '')) throw fail();
      const url = new URL(`/${settings.apiVersion}/dialog/oauth`, dialogOrigin);
      url.searchParams.set('client_id', settings.appId);
      url.searchParams.set('redirect_uri', settings.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'ads_read');
      url.searchParams.set('state', state);
      return url.toString();
    },

    async exchangeCode(code) {
      if (!configValue(code, 4096) || !/^[A-Za-z0-9._~-]+$/.test(code)) throw fail();
      const body = await readJson(endpoint(graphOrigin, settings.apiVersion, 'oauth/access_token', {
        client_id: settings.appId,
        client_secret: settings.appSecret,
        redirect_uri: settings.redirectUri,
        code,
      }), fetchImpl);
      return tokenResponse(body);
    },

    async exchangeForLongLivedToken(shortLivedAccessToken) {
      if (!configValue(shortLivedAccessToken, 16_384)) throw fail();
      const body = await readJson(endpoint(graphOrigin, settings.apiVersion, 'oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: settings.appId,
        client_secret: settings.appSecret,
        fb_exchange_token: shortLivedAccessToken,
      }), fetchImpl);
      return tokenResponse(body);
    },

    async assertAdsReadGranted(accessToken) {
      if (!configValue(accessToken, 16_384)) throw fail();
      const url = endpoint(graphOrigin, settings.apiVersion, 'me/permissions', {});
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        });
      } catch { throw fail(); }
      if (!response?.ok) throw fail();
      let body;
      try {
        const raw = await readBoundedText(response, 64_000);
        body = JSON.parse(raw);
      } catch { throw fail(); }
      if (!body || !Array.isArray(body.data) || body.data.length > 100
        || body.data.some((row) => !row || typeof row.permission !== 'string' || typeof row.status !== 'string')) throw fail();
      const granted = new Set(body.data.filter((row) => row.status === 'granted').map((row) => row.permission));
      const allowed = new Set(['ads_read', 'public_profile']);
      if (!granted.has('ads_read') || [...granted].some((permission) => !allowed.has(permission))) throw fail();
      return Object.freeze({ adsReadGranted: true, grantedScopes: Object.freeze([...granted].sort()) });
    },
  });
}
