import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createGoogleAdsOAuthProtocol } from '../../../../experiments/marketing/google-ads-oauth-protocol.mjs';
import { createGoogleAdsOAuthCredentialEnvelope } from '../../../../experiments/marketing/google-ads-oauth-credential-envelope.mjs';
import { createGoogleAdsOAuthService } from '../../../../experiments/marketing/google-ads-oauth-service.mjs';
import { createGoogleAdsApiRepository } from '../../../../experiments/marketing/google-ads-repository.mjs';

const PROJECT = 'bioalckltvkhlczusdvl';
const DB_HOST = `db.${PROJECT}.supabase.co`;
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com';
const API_ROLE = 'night_scout_google_ads_api_login';
const CALLBACKS = new Set([
  'https://night-scout-xero-staging.onrender.com/api/google-ads/callback',
]);
const ORIGINS = new Set([
  'https://night-scout-xero-staging.onrender.com',
]);
const API_RPCS = new Set([
  'google_ads_v1.worker_create_oauth_state',
  'google_ads_v1.worker_consume_oauth_state',
  'google_ads_v1.worker_create_pending_connection',
  'google_ads_v1.worker_read_pending_selection',
  'google_ads_v1.worker_read_pending_credential',
  'google_ads_v1.worker_activate_selected_account',
  'google_ads_v1.worker_disconnect_connection',
  'google_ads_v1.worker_read_store_status',
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyVersionPattern = /^[A-Za-z0-9._-]{1,128}$/;
const unavailable = () => new Error('Google Ads runtime unavailable');

/**
 * Owner-facing Google Ads OAuth/account-selection runtime. It has Google OAuth
 * app credentials and one fixed staging owner/store, while its database role
 * can call only OAuth and connection RPCs. Reporting and collection use other
 * roles and runtimes.
 */
export async function createGoogleAdsRuntime(env, dependencies = {}) {
  if (env.NIGHT_SCOUT_GOOGLE_ADS_API_RUNTIME_ENABLED !== 'true') return undefined;
  const config = readApiConfig(env);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const pool = await createPinnedPool({
    databaseUrl: config.databaseUrl,
    ca: config.ca,
    role: API_ROLE,
    applicationName: 'night-scout-google-ads-api-staging',
    createPool: dependencies.createPool,
  });

  try {
    const auth = (dependencies.createAuthClient ?? createClient)(config.authUrl, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: boundedAuthFetch(fetchImpl) },
    });
    const envelope = createGoogleAdsOAuthCredentialEnvelope(config.masterKey, config.keyVersion);
    const protocol = createGoogleAdsOAuthProtocol({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    }, fetchImpl);
    const rpc = fixedRpc(pool, API_RPCS);
    const repository = createGoogleAdsApiRepository({ rpc });
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
    const service = createGoogleAdsOAuthService({
      protocol,
      credentialEnvelope: envelope,
      repository,
      authorizeOwner,
      pkceKey: config.pkceKey,
      apiVersion: 'v26',
      // Staging OAuth apps remain in Testing mode. The SQL RPC schedules
      // re-consent before Google's seven-day refresh-token expiry.
      oauthAppPublishingStatus: 'testing',
      fetchImpl,
    });
    return Object.freeze({
      service,
      authenticate,
      allowedOrigins: Object.freeze([config.allowedOrigin]),
      async close() { await pool.end(); },
    });
  } catch {
    try { await pool.end(); } catch { /* keep the generic initialization error */ }
    throw unavailable();
  }
}

function readApiConfig(env) {
  const common = readCommonConfig(env);
  const authUrl = env.NIGHT_SCOUT_REVIEW_AUTH_URL ?? env.VITE_SUPABASE_URL;
  const publishableKey = env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  const clientId = env.NIGHT_SCOUT_GOOGLE_ADS_CLIENT_ID;
  const clientSecret = env.NIGHT_SCOUT_GOOGLE_ADS_CLIENT_SECRET;
  const redirectUri = env.NIGHT_SCOUT_GOOGLE_ADS_REDIRECT_URI;
  const ownerId = env.NIGHT_SCOUT_GOOGLE_ADS_STAGING_OWNER_ID;
  const storeId = env.NIGHT_SCOUT_GOOGLE_ADS_STAGING_STORE_ID;
  const allowedOrigin = env.NIGHT_SCOUT_GOOGLE_ADS_ALLOWED_ORIGIN;
  const databaseUrl = env.NIGHT_SCOUT_GOOGLE_ADS_API_DATABASE_URL;
  if (authUrl !== `https://${PROJECT}.supabase.co`
    || typeof publishableKey !== 'string' || publishableKey.length < 20 || publishableKey.length > 4096
    || !uuid.test(ownerId ?? '') || !uuid.test(storeId ?? '')
    || typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{20,256}\.apps\.googleusercontent\.com$/.test(clientId)
    || typeof clientSecret !== 'string' || clientSecret.length < 8 || clientSecret.length > 512
    || !CALLBACKS.has(redirectUri ?? '') || !ORIGINS.has(allowedOrigin ?? '')
    || new URL(redirectUri).origin !== allowedOrigin
    || !isPinnedGoogleDatabaseUrl(databaseUrl, API_ROLE)) throw unavailable();
  return Object.freeze({
    ...common, authUrl, publishableKey, clientId, clientSecret, redirectUri,
    ownerId, storeId, allowedOrigin, databaseUrl,
  });
}

function readCommonConfig(env) {
  const ca = env.NIGHT_SCOUT_STAGING_CA_PEM;
  const masterKey = env.NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_MASTER_KEY;
  const keyVersion = env.NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_KEY_VERSION;
  const pkceKey = env.NIGHT_SCOUT_GOOGLE_ADS_PKCE_KEY;
  if (env.NIGHT_SCOUT_RUNTIME_ENV !== 'staging'
    || env.NIGHT_SCOUT_GOOGLE_ADS_STAGING_PROJECT_REF !== PROJECT
    || typeof ca !== 'string' || !ca.includes('BEGIN CERTIFICATE') || ca.length > 32_768
    || typeof masterKey !== 'string' || Buffer.byteLength(masterKey) < 32 || Buffer.byteLength(masterKey) > 4096
    || !keyVersionPattern.test(keyVersion ?? '')
    || typeof pkceKey !== 'string' || Buffer.byteLength(pkceKey) < 32 || Buffer.byteLength(pkceKey) > 4096) throw unavailable();
  return Object.freeze({ ca, masterKey, keyVersion, pkceKey });
}

async function createPinnedPool({ databaseUrl, ca, role, applicationName, createPool }) {
  if (!isPinnedGoogleDatabaseUrl(databaseUrl, role)) throw unavailable();
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
    try { await pool.end(); } catch { /* keep the generic startup failure */ }
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
      } catch { throw unavailable(); }
    },
  });
}

function isPinnedGoogleDatabaseUrl(value, role) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const username = decodeURIComponent(url.username);
    const direct = url.hostname === DB_HOST && username === role;
    const sessionPooler = url.hostname === POOLER_HOST && username === `${role}.${PROJECT}`;
    return (url.protocol === 'postgres:' || url.protocol === 'postgresql:')
      && (direct || sessionPooler) && (!url.port || url.port === '5432')
      && url.pathname === '/postgres' && url.password.length > 0 && !url.search && !url.hash;
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
