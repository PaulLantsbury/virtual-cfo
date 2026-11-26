import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createMetaOAuthProtocol } from '../../../../experiments/marketing/meta-oauth-protocol.mjs';
import { createMetaCredentialEnvelope } from '../../../../experiments/marketing/meta-credential-envelope.mjs';
import { createMetaOAuthService } from '../../../../experiments/marketing/meta-oauth-service.mjs';
import { createMetaAdsApiRepository } from '../../../../experiments/marketing/meta-ads-repository.mjs';

const PROJECT = 'bioalckltvkhlczusdvl';
const DB_HOST = `db.${PROJECT}.supabase.co`;
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com';
const API_ROLE = 'night_scout_meta_ads_api_login';
const CALLBACKS = new Set([
  'https://night-scout-xero-staging.replit.app/api/meta-ads/callback',
  'https://night-scout-xero-staging.onrender.com/api/meta-ads/callback',
]);
const ORIGINS = new Set([
  'https://night-scout-xero-staging.replit.app',
  'https://night-scout-xero-staging.onrender.com',
]);
const API_RPCS = new Set([
  'meta_ads_v1.worker_create_oauth_state',
  'meta_ads_v1.worker_consume_oauth_state',
  'meta_ads_v1.worker_create_pending_connection',
  'meta_ads_v1.worker_read_pending_selection',
  'meta_ads_v1.worker_cancel_pending_selection',
  'meta_ads_v1.worker_activate_selected_account',
  'meta_ads_v1.worker_disconnect_connection',
  'meta_ads_v1.worker_read_store_status',
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canonical = /^[A-Za-z0-9._-]{1,128}$/;
const unavailable = () => new Error('Meta Ads runtime unavailable');

/**
 * Owner-facing API runtime. It has app OAuth credentials and a fixed staging
 * owner/store allowlist, but its database role can call only OAuth, account
 * selection, disconnect and status RPCs. Collection is a separate runtime.
 */
export async function createMetaAdsRuntime(env, dependencies = {}) {
  if (env.NIGHT_SCOUT_META_ADS_API_RUNTIME_ENABLED !== 'true') return undefined;
  const config = readApiConfig(env);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const pool = await createPinnedPool({
    databaseUrl: config.databaseUrl,
    ca: config.ca,
    role: API_ROLE,
    applicationName: 'night-scout-meta-ads-api-staging',
    createPool: dependencies.createPool,
  });

  try {
    const authUrl = env.NIGHT_SCOUT_REVIEW_AUTH_URL ?? env.VITE_SUPABASE_URL;
    const publishableKey = env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY ?? env.VITE_SUPABASE_ANON_KEY;
    const auth = (dependencies.createAuthClient ?? createClient)(authUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: boundedAuthFetch(fetchImpl) },
    });
    const envelope = createMetaCredentialEnvelope(config.masterKey, config.keyVersion);
    const protocol = createMetaOAuthProtocol({
      appId: config.appId,
      appSecret: config.appSecret,
      apiVersion: config.apiVersion,
      redirectUri: config.redirectUri,
    }, fetchImpl);
    const rpc = fixedRpc(pool, API_RPCS);
    const repository = createMetaAdsApiRepository({ rpc, credentialEnvelope: envelope, apiVersion: config.apiVersion });
    const authenticate = async (authorization) => {
      if (typeof authorization !== 'string' || !/^Bearer [^\s,]+$/i.test(authorization)) throw unavailable();
      const token = authorization.replace(/^Bearer\s+/i, '');
      let result;
      try { result = await auth.auth.getUser(token); } catch { throw unavailable(); }
      const userId = result?.data?.user?.id;
      if (result?.error || userId !== config.ownerId) throw unavailable();
      return Object.freeze({ userId, isOwner: true });
    };
    const authorizeOwner = async ({ userId, storeId }) => userId === config.ownerId && storeId === config.storeId;
    const service = createMetaOAuthService({
      protocol,
      credentialEnvelope: envelope,
      repository,
      authorizeOwner,
      apiVersion: config.apiVersion,
      fetchImpl,
    });
    return Object.freeze({
      service,
      authenticate,
      allowedOrigins: config.allowedOrigins,
      async close() { await pool.end(); },
    });
  } catch {
    try { await pool.end(); } catch { /* retain the generic initialization failure */ }
    throw unavailable();
  }
}

function readApiConfig(env) {
  const common = readCommonConfig(env);
  const authUrl = env.NIGHT_SCOUT_REVIEW_AUTH_URL ?? env.VITE_SUPABASE_URL;
  const publishableKey = env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  const appId = env.NIGHT_SCOUT_META_ADS_APP_ID;
  const appSecret = env.NIGHT_SCOUT_META_ADS_APP_SECRET;
  const redirectUri = env.NIGHT_SCOUT_META_ADS_REDIRECT_URI;
  const ownerId = env.NIGHT_SCOUT_META_ADS_STAGING_OWNER_ID;
  const storeId = env.NIGHT_SCOUT_META_ADS_STAGING_STORE_ID;
  const allowedOrigin = env.NIGHT_SCOUT_META_ADS_ALLOWED_ORIGIN;
  const databaseUrl = env.NIGHT_SCOUT_META_ADS_API_DATABASE_URL;
  if (authUrl !== `https://${PROJECT}.supabase.co`
    || typeof publishableKey !== 'string' || publishableKey.length < 20 || publishableKey.length > 4096
    || !uuid.test(ownerId ?? '') || !uuid.test(storeId ?? '')
    || !/^\d{5,32}$/.test(appId ?? '') || typeof appSecret !== 'string' || appSecret.length < 24 || appSecret.length > 2048
    || !CALLBACKS.has(redirectUri ?? '') || !ORIGINS.has(allowedOrigin ?? '')
    || new URL(redirectUri).origin !== allowedOrigin || !isPinnedMetaDatabaseUrl(databaseUrl, API_ROLE)) throw unavailable();
  return Object.freeze({ ...common, authUrl, publishableKey, appId, appSecret, redirectUri, ownerId, storeId,
    allowedOrigins: Object.freeze([allowedOrigin]), databaseUrl });
}

function readCommonConfig(env) {
  const ca = env.NIGHT_SCOUT_STAGING_CA_PEM;
  const masterKey = env.NIGHT_SCOUT_META_ADS_ENVELOPE_MASTER_KEY;
  const keyVersion = env.NIGHT_SCOUT_META_ADS_ENVELOPE_KEY_VERSION;
  const apiVersion = env.NIGHT_SCOUT_META_ADS_API_VERSION;
  if (env.NIGHT_SCOUT_RUNTIME_ENV !== 'staging'
    || env.NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF !== PROJECT
    || typeof ca !== 'string' || !ca.includes('BEGIN CERTIFICATE') || ca.length > 32_768
    || typeof masterKey !== 'string' || Buffer.byteLength(masterKey) < 32
    || !canonical.test(keyVersion ?? '') || !/^v\d+\.\d+$/.test(apiVersion ?? '')) throw unavailable();
  return Object.freeze({ ca, masterKey, keyVersion, apiVersion });
}

async function createPinnedPool({ databaseUrl, ca, role, applicationName, createPool }) {
  if (!isPinnedMetaDatabaseUrl(databaseUrl, role)) throw unavailable();
  const pool = (createPool ?? ((options) => new pg.Pool(options)))({
    connectionString: databaseUrl,
    ssl: { ca, rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
    application_name: applicationName,
  });
  try {
    const identity = await pool.query('SELECT session_user::text AS session_user, current_user::text AS current_user');
    if (identity.rows.length !== 1 || identity.rows[0]?.session_user !== role || identity.rows[0]?.current_user !== role) throw unavailable();
    return pool;
  } catch {
    try { await pool.end(); } catch { /* retain the generic startup failure */ }
    throw unavailable();
  }
}

function fixedRpc(pool, allowlist) {
  return Object.freeze({
    async call(name, args) {
      if (!allowlist.has(name) || !Array.isArray(args) || args.length > 16) throw unavailable();
      const placeholders = args.map((_, index) => `$${index + 1}`).join(',');
      try {
        const result = await pool.query(`SELECT * FROM ${name}(${placeholders})`, args);
        return result.rows;
      } catch {
        throw unavailable();
      }
    },
  });
}

function isPinnedMetaDatabaseUrl(value, role = API_ROLE) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const username = decodeURIComponent(url.username);
    const direct = url.hostname === DB_HOST && username === role;
    const sessionPooler = url.hostname === POOLER_HOST && username === `${role}.${PROJECT}`;
    return (url.protocol === 'postgres:' || url.protocol === 'postgresql:')
      && (direct || sessionPooler)
      && (!url.port || url.port === '5432')
      && url.pathname === '/postgres'
      && url.password.length > 0
      && url.search === ''
      && url.hash === '';
  } catch { return false; }
}

function boundedAuthFetch(fetchImpl) {
  return (input, init) => fetchImpl(input, {
    ...init,
    redirect: 'error',
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)])
      : AbortSignal.timeout(10_000),
  });
}
