import { Router, json, type ErrorRequestHandler, type IRouter } from 'express';

type GoogleAdsIdentity = Readonly<{ userId: string; isOwner: boolean }>;
type GoogleAdsAuthenticator = (authorization: string) => Promise<GoogleAdsIdentity> | GoogleAdsIdentity;
type GoogleAdsService = Readonly<{
  start(identity: GoogleAdsIdentity, input: Readonly<{ storeId: string }>): Promise<Readonly<{ url: string }>>;
  complete(input: Readonly<{ state: string; code: string }>): Promise<Readonly<{ status: string; selectionHandle?: string }>>;
  deny(input: Readonly<{ state: string }>): Promise<Readonly<{ status: string }>>;
  readAccountSelections(identity: GoogleAdsIdentity, input: Readonly<{ storeId: string; selectionHandle: string }>): Promise<unknown>;
  readStatus(identity: GoogleAdsIdentity, input: Readonly<{ storeId: string }>): Promise<unknown>;
  selectAccount(identity: GoogleAdsIdentity, input: Readonly<{
    storeId: string; selectionHandle: string; customerId: string; loginCustomerId: string | null;
  }>): Promise<unknown>;
  disconnect(identity: GoogleAdsIdentity, input: Readonly<{ storeId: string; connectionId: string }>): Promise<unknown>;
}>;
export type GoogleAdsRouterDependencies = Readonly<{
  service?: GoogleAdsService;
  authenticate?: GoogleAdsAuthenticator;
  allowedOrigins?: readonly string[];
}>;

const cookieName = 'ns_google_ads_selection';
const cookiePath = '/api/google-ads';
const selectionCookieTtlSeconds = 900;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const customerId = /^\d{10}$/;
const opaque = /^[A-Za-z0-9_-]{43}$/;
const oauthCode = /^[A-Za-z0-9._~+\-/=]{8,4096}$/;
const callbackKeys = new Set(['code', 'error', 'error_code', 'error_description', 'error_reason', 'error_subcode', 'error_type', 'state']);
const fail = (res: any, status = 503) => res.status(status).json({ error: 'Google Ads connection unavailable' });
const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object'
  && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function scalar(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function validIdentity(value: unknown): GoogleAdsIdentity | null {
  if (!plain(value) || !scalar(value.userId, uuid) || value.isOwner !== true) return null;
  return Object.freeze({ userId: value.userId, isOwner: true });
}

function bearer(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 8192 && /^Bearer [^\s,]+$/i.test(value);
}

function readSelectionCookie(header: unknown): string | null {
  if (typeof header !== 'string' || header.length > 16_384) return null;
  let found: string | null = null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== cookieName) continue;
    if (found !== null) return null;
    const value = part.slice(separator + 1).trim();
    if (!opaque.test(value)) return null;
    found = value;
  }
  return found;
}

function setSelectionCookie(res: any, handle: string): void {
  res.setHeader('Set-Cookie', `${cookieName}=${handle}; Max-Age=${selectionCookieTtlSeconds}; Path=${cookiePath}; HttpOnly; Secure; SameSite=Lax`);
}

function clearSelectionCookie(res: any): void {
  res.setHeader('Set-Cookie', `${cookieName}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${cookiePath}; HttpOnly; Secure; SameSite=Lax`);
}

function safeAccountSelectionResponse(value: unknown): Readonly<{ status: string; accounts: readonly Readonly<{ customerId: string; loginCustomerId: string | null }>[]; expiresAt: string }> | null {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'accounts,expiresAt,status'
    || value.status !== 'account_selection_required' || !Array.isArray(value.accounts)
    || value.accounts.length < 1 || value.accounts.length > 5_000
    || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) return null;
  const accounts: Array<Readonly<{ customerId: string; loginCustomerId: string | null }>> = [];
  const seen = new Set<string>();
  for (const account of value.accounts) {
    if (!plain(account) || Object.keys(account).sort().join(',') !== 'customerId,loginCustomerId'
      || !scalar(account.customerId, customerId)
      || (account.loginCustomerId !== null && !scalar(account.loginCustomerId, customerId))
      || account.loginCustomerId === account.customerId) return null;
    const key = `${account.loginCustomerId ?? ''}:${account.customerId}`;
    if (seen.has(key)) return null;
    seen.add(key);
    accounts.push(Object.freeze({ customerId: account.customerId, loginCustomerId: account.loginCustomerId }));
  }
  return Object.freeze({
    status: 'account_selection_required',
    accounts: Object.freeze(accounts),
    expiresAt: new Date(value.expiresAt).toISOString(),
  });
}

function safeConnectedResponse(value: unknown): Readonly<Record<string, unknown>> | null {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'connectedAt,currency,customerId,loginCustomerId,status,timeZone'
    || value.status !== 'connected' || !scalar(value.customerId, customerId)
    || (value.loginCustomerId !== null && !scalar(value.loginCustomerId, customerId))
    || value.loginCustomerId === value.customerId || !scalar(value.currency, /^[A-Z]{3}$/)
    || typeof value.timeZone !== 'string' || value.timeZone.length < 1 || value.timeZone.length > 128
    || typeof value.connectedAt !== 'string' || !Number.isFinite(Date.parse(value.connectedAt))) return null;
  return Object.freeze({
    status: 'connected',
    customerId: value.customerId,
    loginCustomerId: value.loginCustomerId,
    currency: value.currency,
    timeZone: value.timeZone,
    connectedAt: new Date(value.connectedAt).toISOString(),
  });
}

function safeStatusResponse(value: unknown): Readonly<Record<string, unknown>> | null {
  if (!plain(value) || Object.keys(value).join(',') !== 'provider,connections'
    || value.provider !== 'google_ads' || !Array.isArray(value.connections) || value.connections.length > 100) return null;
  const connections: Array<Readonly<Record<string, unknown>>> = [];
  for (const row of value.connections) {
    if (!plain(row) || Object.keys(row).sort().join(',') !== 'connectionId,currency,lastCollectedThrough,loginCustomerId,oauthAppPublishingStatus,reauthorizeBy,status,timeZone,updatedAt,customerId'.split(',').sort().join(',')
      || !scalar(row.connectionId, uuid)
      || !['pending', 'connected', 'reauthorization_required', 'disconnected', 'revoked'].includes(String(row.status))
      || !['testing', 'production'].includes(String(row.oauthAppPublishingStatus))
      || (row.customerId !== null && !scalar(row.customerId, customerId))
      || (row.loginCustomerId !== null && !scalar(row.loginCustomerId, customerId))
      || (row.currency !== null && !scalar(row.currency, /^[A-Z]{3}$/))
      || (row.timeZone !== null && (typeof row.timeZone !== 'string' || row.timeZone.length < 1 || row.timeZone.length > 128))
      || (row.reauthorizeBy !== null && (typeof row.reauthorizeBy !== 'string' || !Number.isFinite(Date.parse(row.reauthorizeBy))))
      || (row.lastCollectedThrough !== null && (typeof row.lastCollectedThrough !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.lastCollectedThrough)))
      || (row.updatedAt !== null && (typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))))) return null;
    connections.push(Object.freeze({
      connectionId: row.connectionId,
      status: row.status,
      oauthAppPublishingStatus: row.oauthAppPublishingStatus,
      reauthorizeBy: row.reauthorizeBy,
      customerId: row.customerId,
      loginCustomerId: row.loginCustomerId,
      currency: row.currency,
      timeZone: row.timeZone,
      lastCollectedThrough: row.lastCollectedThrough,
      updatedAt: row.updatedAt,
    }));
  }
  return Object.freeze({ provider: 'google_ads', connections: Object.freeze(connections) });
}

/** Disabled until the authenticated Google Ads service and fixed RPCs are injected. */
export function createGoogleAdsRouter(dependencies: GoogleAdsRouterDependencies = {}): IRouter {
  const router = Router();
  const { service, authenticate, allowedOrigins = [] } = dependencies;
  const origins = new Set(allowedOrigins);
  const sameOrigin = (value: unknown): value is string => typeof value === 'string' && origins.has(value);
  const owner = async (authorization: unknown): Promise<GoogleAdsIdentity | null> => {
    if (!bearer(authorization)) return null;
    try { return validIdentity(await authenticate!(authorization)); } catch { return null; }
  };

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    if (!service || !authenticate || origins.size === 0) return fail(res);
    next();
  });
  router.use(json({ limit: '8kb', strict: true, type: 'application/json' }));

  router.post('/connect', async (req, res) => {
    if (!sameOrigin(req.headers.origin)) return fail(res, 403);
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const body = req.body;
    if (!plain(body) || Object.keys(body).length !== 1 || !scalar(body.storeId, uuid)) return fail(res, 400);
    try {
      const result = await service!.start(identity, Object.freeze({ storeId: body.storeId }));
      const url = new URL(result.url);
      if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth'
        || url.searchParams.get('response_type') !== 'code'
        || url.searchParams.get('scope') !== 'https://www.googleapis.com/auth/adwords'
        || !scalar(url.searchParams.get('state'), /^[A-Za-z0-9_-]{1,128}$/)) return fail(res);
      return res.status(200).json({ url: url.toString() });
    } catch { return fail(res); }
  });

  router.get('/callback', async (req, res) => {
    const query = req.query as Record<string, unknown>;
    if (!query || typeof query !== 'object' || Object.keys(query).some((key) => !callbackKeys.has(key))
      || !scalar(query.state, opaque)) return fail(res, 400);
    try {
      if (query.error !== undefined || query.error_description !== undefined || query.error_reason !== undefined
        || query.error_code !== undefined || query.error_subcode !== undefined || query.error_type !== undefined) {
        await service!.deny(Object.freeze({ state: query.state }));
        clearSelectionCookie(res);
        return res.redirect(303, '/settings?googleAds=cancelled');
      }
      if (!scalar(query.code, oauthCode)) return fail(res, 400);
      const result = await service!.complete(Object.freeze({ state: query.state, code: query.code }));
      if (result.status !== 'account_selection_required' || !scalar(result.selectionHandle, opaque)) return fail(res);
      setSelectionCookie(res, result.selectionHandle);
      return res.redirect(303, '/settings?googleAds=select');
    } catch { return fail(res); }
  });

  router.get('/account-selections', async (req, res) => {
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const query = req.query as Record<string, unknown>;
    if (!query || Object.keys(query).length !== 1 || !scalar(query.storeId, uuid)) return fail(res, 400);
    const handle = readSelectionCookie(req.headers.cookie);
    if (!handle) return fail(res, 404);
    try {
      const result = safeAccountSelectionResponse(await service!.readAccountSelections(identity, Object.freeze({
        storeId: query.storeId,
        selectionHandle: handle,
      })));
      if (!result) throw new Error('Google Ads account selection unavailable');
      return res.status(200).json(result);
    } catch {
      clearSelectionCookie(res);
      return fail(res, 404);
    }
  });

  router.get('/status', async (req, res) => {
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const query = req.query as Record<string, unknown>;
    if (!query || Object.keys(query).length !== 1 || !scalar(query.storeId, uuid)) return fail(res, 400);
    try {
      const result = safeStatusResponse(await service!.readStatus(identity, Object.freeze({ storeId: query.storeId })));
      if (!result) throw new Error('Google Ads status unavailable');
      return res.status(200).json(result);
    }
    catch { return fail(res, 404); }
  });

  router.post('/select-account', async (req, res) => {
    if (!sameOrigin(req.headers.origin)) return fail(res, 403);
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const body = req.body;
    if (!plain(body) || !['customerId,storeId', 'customerId,loginCustomerId,storeId'].includes(Object.keys(body).sort().join(','))
      || !scalar(body.storeId, uuid) || !scalar(body.customerId, customerId)
      || (body.loginCustomerId !== undefined && body.loginCustomerId !== null && !scalar(body.loginCustomerId, customerId))) return fail(res, 400);
    const handle = readSelectionCookie(req.headers.cookie);
    if (!handle) return fail(res, 404);
    try {
      const result = safeConnectedResponse(await service!.selectAccount(identity, Object.freeze({
        storeId: body.storeId,
        selectionHandle: handle,
        customerId: body.customerId,
        loginCustomerId: body.loginCustomerId ?? null,
      })));
      if (!result) throw new Error('Google Ads account selection unavailable');
      clearSelectionCookie(res);
      return res.status(200).json(result);
    } catch { return fail(res, 409); }
  });

  router.post('/disconnect', async (req, res) => {
    if (!sameOrigin(req.headers.origin)) return fail(res, 403);
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const body = req.body;
    if (!plain(body) || Object.keys(body).sort().join(',') !== 'connectionId,storeId'
      || !scalar(body.storeId, uuid) || !scalar(body.connectionId, uuid)) return fail(res, 400);
    try {
      const result = await service!.disconnect(identity, Object.freeze({ storeId: body.storeId, connectionId: body.connectionId }));
      if (!plain(result) || Object.keys(result).join(',') !== 'status' || result.status !== 'disconnected') throw new Error('Google Ads disconnect unavailable');
      clearSelectionCookie(res);
      return res.status(200).json({ status: 'disconnected' });
    } catch { return fail(res, 409); }
  });

  const parserErrors: ErrorRequestHandler = (error, _req, res, _next) => fail(res, error?.type === 'entity.too.large' ? 413 : 400);
  router.use(parserErrors);
  return router;
}
