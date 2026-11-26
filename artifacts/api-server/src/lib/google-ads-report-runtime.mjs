import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createGoogleAdsSpendReportRepository } from '../../../../experiments/marketing/google-ads-report-repository.mjs';

const PROJECT = 'bioalckltvkhlczusdvl';
const DB_HOST = `db.${PROJECT}.supabase.co`;
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com';
const REPORT_ROLE = 'night_scout_google_ads_report_login';
const REPORT_RPCS = new Set(['google_ads_v1.worker_read_daily_spend']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const unavailable = () => new Error('Google Ads spend reporting unavailable');

/**
 * Report-only Google Ads runtime. It has no Google OAuth credentials, token
 * envelope key, or provider fetch path. Its database login can call only the
 * fixed daily spend read RPC and cannot read provider tables directly.
 */
export async function createGoogleAdsReportRuntime(env, dependencies = {}) {
  if (env.NIGHT_SCOUT_GOOGLE_ADS_REPORT_RUNTIME_ENABLED !== 'true') return undefined;
  const config = readConfig(env);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const pool = await createPinnedPool({
    databaseUrl: config.databaseUrl,
    ca: config.ca,
    role: REPORT_ROLE,
    createPool: dependencies.createPool,
  });

  try {
    const auth = (dependencies.createAuthClient ?? createClient)(config.authUrl, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: boundedAuthFetch(fetchImpl) },
    });
    const authenticate = async (authorization) => {
      if (typeof authorization !== 'string' || !/^Bearer [^\s,]+$/i.test(authorization)) throw unavailable();
      let result;
      try { result = await auth.auth.getUser(authorization.replace(/^Bearer\s+/i, '')); } catch { throw unavailable(); }
      const userId = result?.data?.user?.id;
      if (result?.error || userId !== config.ownerId) throw unavailable();
      return Object.freeze({ userId, isOwner: true });
    };
    const repository = createGoogleAdsSpendReportRepository({ rpc: fixedRpc(pool) });
    const service = Object.freeze({
      async readSpend(identity, input) {
        if (!identity || identity.userId !== config.ownerId || identity.isOwner !== true
          || input?.storeId !== config.storeId || !validDay(input?.from) || !validDay(input?.to)
          || input.from > input.to || dayDistance(input.from, input.to) > 92) throw unavailable();
        try { return await repository.readSpend(identity, input); }
        catch { throw unavailable(); }
      },
    });
    return Object.freeze({ service, authenticate, async close() { await pool.end(); } });
  } catch {
    try { await pool.end(); } catch { /* keep the generic startup failure */ }
    throw unavailable();
  }
}

function readConfig(env) {
  const ca = env.NIGHT_SCOUT_STAGING_CA_PEM;
  const authUrl = env.NIGHT_SCOUT_REVIEW_AUTH_URL ?? env.VITE_SUPABASE_URL;
  const publishableKey = env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  const ownerId = env.NIGHT_SCOUT_GOOGLE_ADS_STAGING_OWNER_ID;
  const storeId = env.NIGHT_SCOUT_GOOGLE_ADS_STAGING_STORE_ID;
  const databaseUrl = env.NIGHT_SCOUT_GOOGLE_ADS_REPORT_DATABASE_URL;
  if (env.NIGHT_SCOUT_RUNTIME_ENV !== 'staging'
    || env.NIGHT_SCOUT_GOOGLE_ADS_STAGING_PROJECT_REF !== PROJECT
    || typeof ca !== 'string' || !ca.includes('BEGIN CERTIFICATE') || ca.length > 32_768
    || authUrl !== `https://${PROJECT}.supabase.co`
    || typeof publishableKey !== 'string' || publishableKey.length < 20 || publishableKey.length > 4096
    || !uuid.test(ownerId ?? '') || !uuid.test(storeId ?? '')
    || !isPinnedGoogleDatabaseUrl(databaseUrl)) throw unavailable();
  return Object.freeze({ ca, authUrl, publishableKey, ownerId, storeId, databaseUrl });
}

async function createPinnedPool({ databaseUrl, ca, role, createPool }) {
  const pool = (createPool ?? ((options) => new pg.Pool(options)))({
    connectionString: databaseUrl,
    ssl: { ca, rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
    application_name: 'night-scout-google-ads-report-staging',
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

function fixedRpc(pool) {
  return Object.freeze({
    async call(name, args) {
      if (!REPORT_RPCS.has(name) || !Array.isArray(args) || args.length !== 5) throw unavailable();
      try {
        const result = await pool.query(`SELECT * FROM ${name}($1,$2,$3::date,$4::date,$5::timestamptz)`, args);
        return result.rows;
      } catch { throw unavailable(); }
    },
  });
}

function isPinnedGoogleDatabaseUrl(value) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const username = decodeURIComponent(url.username);
    const direct = url.hostname === DB_HOST && username === REPORT_ROLE;
    const sessionPooler = url.hostname === POOLER_HOST && username === `${REPORT_ROLE}.${PROJECT}`;
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

function validDay(value) {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function dayDistance(from, to) {
  return (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;
}
