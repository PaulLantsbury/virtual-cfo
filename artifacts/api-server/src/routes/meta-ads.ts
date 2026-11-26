import { Router, json, type ErrorRequestHandler, type IRouter } from 'express';

type MetaIdentity = Readonly<{ userId: string; isOwner: boolean }>;
type MetaAuthenticator = (authorization: string) => Promise<MetaIdentity> | MetaIdentity;
type MetaService = Readonly<{
  start(identity: MetaIdentity, input: Readonly<{ storeId: string }>): Promise<Readonly<{ url: string }>>;
  complete(input: Readonly<{ state: string; code: string }>): Promise<Readonly<{ status: string; selectionHandle?: string }>>;
  deny(input: Readonly<{ state: string }>): Promise<Readonly<{ status: string }>>;
  readSelection(identity: MetaIdentity, input: Readonly<{ storeId: string; selectionHandle: string }>): Promise<unknown>;
  cancelPendingSelection(identity: MetaIdentity, input: Readonly<{ storeId: string; selectionHandle: string }>): Promise<Readonly<{ status: string }>>;
  readStatus(identity: MetaIdentity, input: Readonly<{ storeId: string }>): Promise<unknown>;
  selectAccount(identity: MetaIdentity, input: Readonly<{ storeId: string; selectionHandle: string; accountId: string }>): Promise<unknown>;
  disconnect(identity: MetaIdentity, input: Readonly<{ storeId: string; connectionId: string }>): Promise<unknown>;
}>;
export type MetaAdsRouterDependencies = Readonly<{
  service?: MetaService;
  authenticate?: MetaAuthenticator;
  allowedOrigins?: readonly string[];
}>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accountId = /^\d{5,32}$/;
const opaque = /^[A-Za-z0-9_-]{32,512}$/;
const selectionHandlePattern = /^[A-Za-z0-9_-]{43}$/;
const selectionCookieName = 'ns_meta_ads_selection';
const selectionCookiePath = '/api/meta-ads';
const selectionCookieTtlSeconds = 900;
const oauthCode = /^[A-Za-z0-9._~-]{8,4096}$/;
const callbackKeys = new Set(['code', 'error', 'error_code', 'error_description', 'error_reason', 'error_subcode', 'error_type', 'state']);
const fail = (res: any, status = 503) => res.status(status).json({ error: 'Meta Ads connection unavailable' });
const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object'
  && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function validIdentity(value: unknown): MetaIdentity | null {
  if (!plain(value) || typeof value.userId !== 'string' || !uuid.test(value.userId)
    || value.isOwner !== true) return null;
  return Object.freeze({ userId: value.userId, isOwner: true });
}

function bearer(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 8192 && /^Bearer [^\s,]+$/i.test(value);
}

function scalar(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function readSelectionCookie(cookies: unknown, header: unknown): string | null {
  if (typeof header === 'string') {
    if (header.length > 16_384) return null;
    let found: string | null = null;
    for (const part of header.split(';')) {
      const separator = part.indexOf('=');
      if (separator < 0 || part.slice(0, separator).trim() !== selectionCookieName) continue;
      if (found !== null) return null;
      const value = part.slice(separator + 1).trim();
      if (!selectionHandlePattern.test(value)) return null;
      found = value;
    }
    return found;
  }
  if (plain(cookies) && Object.hasOwn(cookies, selectionCookieName)) {
    const value = cookies[selectionCookieName];
    return scalar(value, selectionHandlePattern) ? value : null;
  }
  return null;
}

function setSelectionCookie(res: any, handle: string): void {
  res.setHeader('Set-Cookie', `${selectionCookieName}=${handle}; Max-Age=${selectionCookieTtlSeconds}; Path=${selectionCookiePath}; HttpOnly; Secure; SameSite=Lax`);
}

function clearSelectionCookie(res: any): void {
  res.setHeader('Set-Cookie', `${selectionCookieName}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${selectionCookiePath}; HttpOnly; Secure; SameSite=Lax`);
}

/** Disabled until the authenticated service and fixed persistence RPCs are injected. */
export function createMetaAdsRouter(dependencies: MetaAdsRouterDependencies = {}): IRouter {
  const router = Router();
  const { service, authenticate, allowedOrigins = [] } = dependencies;
  const origins = new Set(allowedOrigins);

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    if (!service || !authenticate || origins.size === 0) return fail(res);
    next();
  });
  router.use(json({ limit: '8kb', strict: true, type: 'application/json' }));

  const sameOrigin = (value: unknown): value is string => typeof value === 'string' && origins.has(value);
  const owner = async (authorization: unknown): Promise<MetaIdentity | null> => {
    if (!bearer(authorization)) return null;
    try { return validIdentity(await authenticate!(authorization)); } catch { return null; }
  };

  router.post('/connect', async (req, res) => {
    if (!sameOrigin(req.headers.origin)) return fail(res, 403);
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const body = req.body;
    if (!plain(body) || Object.keys(body).length !== 1 || !scalar(body.storeId, uuid)) return fail(res, 400);
    try {
      const result = await service!.start(identity, Object.freeze({ storeId: body.storeId }));
      const url = new URL(result.url);
      if (url.origin !== 'https://www.facebook.com' || !/^\/v\d+\.\d+\/dialog\/oauth$/.test(url.pathname)
        || url.searchParams.get('scope') !== 'ads_read' || url.searchParams.get('response_type') !== 'code') return fail(res);
      return res.status(200).json({ url: url.toString() });
    } catch { return fail(res); }
  });

  router.get('/callback', async (req, res) => {
    const query = req.query as Record<string, unknown>;
    if (!query || typeof query !== 'object' || Object.keys(query).some((key) => !callbackKeys.has(key))
      || !scalar(query.state, opaque)) return fail(res, 400);
    try {
      if (query.error !== undefined || query.error_description !== undefined
        || query.error_reason !== undefined || query.error_code !== undefined
        || query.error_subcode !== undefined || query.error_type !== undefined) {
        await service!.deny(Object.freeze({ state: query.state }));
        clearSelectionCookie(res);
        return res.redirect(303, '/settings?metaConnect=cancelled');
      }
      if (!scalar(query.code, oauthCode)) return fail(res, 400);
      const result = await service!.complete(Object.freeze({ state: query.state, code: query.code }));
      if (result.status !== 'account_selection_required' || !scalar(result.selectionHandle, selectionHandlePattern)) return fail(res);
      setSelectionCookie(res, result.selectionHandle);
      return res.redirect(303, '/settings?metaSelection=select');
    } catch { return fail(res); }
  });

  router.get('/selection', async (req, res) => {
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const query = req.query as Record<string, unknown>;
    const { storeId } = query;
    if (Object.keys(query).length !== 1 || !scalar(storeId, uuid)) return fail(res, 400);
    const selectionHandle = readSelectionCookie(req.cookies, req.headers.cookie);
    if (!selectionHandle) return fail(res, 404);
    try { return res.status(200).json(await service!.readSelection(identity, Object.freeze({ storeId, selectionHandle }))); }
    catch { clearSelectionCookie(res); return fail(res, 404); }
  });

  router.get('/status', async (req, res) => {
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const query = req.query as Record<string, unknown>;
    const { storeId } = query;
    if (Object.keys(query).length !== 1 || !scalar(storeId, uuid)) return fail(res, 400);
    try { return res.status(200).json(await service!.readStatus(identity, Object.freeze({ storeId }))); }
    catch { return fail(res, 404); }
  });

  router.post('/select-account', async (req, res) => {
    if (!sameOrigin(req.headers.origin)) return fail(res, 403);
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const body = req.body;
    if (!plain(body) || Object.keys(body).sort().join(',') !== 'accountId,storeId'
      || !scalar(body.storeId, uuid)
      || !scalar(body.accountId, accountId)) return fail(res, 400);
    const selectionHandle = readSelectionCookie(req.cookies, req.headers.cookie);
    if (!selectionHandle) return fail(res, 404);
    try {
      const result = await service!.selectAccount(identity, Object.freeze({
        storeId: body.storeId,
        selectionHandle,
        accountId: body.accountId,
      }));
      clearSelectionCookie(res);
      return res.status(200).json(result);
    } catch { return fail(res, 409); }
  });

  router.post('/selection/cancel', async (req, res) => {
    if (!sameOrigin(req.headers.origin)) return fail(res, 403);
    const identity = await owner(req.headers.authorization);
    if (!identity) return fail(res, 401);
    const body = req.body;
    if (!plain(body) || Object.keys(body).length !== 1 || !scalar(body.storeId, uuid)) return fail(res, 400);
    const selectionHandle = readSelectionCookie(req.cookies, req.headers.cookie);
    if (!selectionHandle) return fail(res, 404);
    try {
      const result = await service!.cancelPendingSelection(identity, Object.freeze({ storeId: body.storeId, selectionHandle }));
      if (result.status !== 'cancelled') return fail(res, 409);
      clearSelectionCookie(res);
      return res.status(200).json({ status: 'cancelled' });
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
      return res.status(200).json(await service!.disconnect(identity, Object.freeze({
        storeId: body.storeId,
        connectionId: body.connectionId,
      })));
    } catch { return fail(res, 409); }
  });

  const parserErrors: ErrorRequestHandler = (error, _req, res, _next) => fail(res, error?.type === 'entity.too.large' ? 413 : 400);
  router.use(parserErrors);
  return router;
}
