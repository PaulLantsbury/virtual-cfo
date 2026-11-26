import { isMetaSpendTimestamp } from '../../../../experiments/marketing/meta-spend-report-contract.mjs';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const PROJECT = 'bioalckltvkhlczusdvl';
const DB_HOST = `db.${PROJECT}.supabase.co`;
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com';
const REPORT_ROLE = 'night_scout_meta_ads_report_login';
const REPORT_RPC = 'meta_ads_v1.worker_read_daily_spend';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accountId = /^\d{5,32}$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const states = new Set(['provider_row', 'no_row', 'partial', 'failed']);
const unavailable = () => new Error('Meta Ads spend reporting unavailable');

export async function createMetaAdsReportRuntime(env, dependencies = {}) {
  if (env.NIGHT_SCOUT_META_ADS_REPORT_RUNTIME_ENABLED !== 'true') return undefined;
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
    const service = Object.freeze({
      async readSpend(identity, input) {
        if (!identity || identity.userId !== config.ownerId || identity.isOwner !== true
          || input?.storeId !== config.storeId || !validDay(input?.from) || !validDay(input?.to)
          || input.from > input.to || dayDistance(input.from, input.to) > 92) throw unavailable();
        let result;
        try {
          result = await pool.query(`SELECT * FROM ${REPORT_RPC}($1,$2,$3::date,$4::date,$5::timestamptz)`, [
            identity.userId, input.storeId, input.from, input.to, new Date().toISOString(),
          ]);
        } catch { throw unavailable(); }
        return shapeReportRows(result.rows, input.storeId, input.from, input.to);
      },
    });
    return Object.freeze({ service, authenticate, async close() { await pool.end(); } });
  } catch {
    try { await pool.end(); } catch { /* keep the generic initialization error */ }
    throw unavailable();
  }
}

function readConfig(env) {
  const ca = env.NIGHT_SCOUT_STAGING_CA_PEM;
  const authUrl = env.NIGHT_SCOUT_REVIEW_AUTH_URL ?? env.VITE_SUPABASE_URL;
  const publishableKey = env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  const ownerId = env.NIGHT_SCOUT_META_ADS_STAGING_OWNER_ID;
  const storeId = env.NIGHT_SCOUT_META_ADS_STAGING_STORE_ID;
  const databaseUrl = env.NIGHT_SCOUT_META_ADS_REPORT_DATABASE_URL;
  if (env.NIGHT_SCOUT_RUNTIME_ENV !== 'staging'
    || env.NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF !== PROJECT
    || typeof ca !== 'string' || !ca.includes('BEGIN CERTIFICATE') || ca.length > 32_768
    || authUrl !== `https://${PROJECT}.supabase.co`
    || typeof publishableKey !== 'string' || publishableKey.length < 20 || publishableKey.length > 4096
    || !uuid.test(ownerId ?? '') || !uuid.test(storeId ?? '')
    || !isPinnedReportDatabaseUrl(databaseUrl)) throw unavailable();
  return Object.freeze({ ca, authUrl, publishableKey, ownerId, storeId, databaseUrl });
}

async function createPinnedPool({ databaseUrl, ca, role, createPool }) {
  const pool = (createPool ?? ((options) => new pg.Pool(options)))({
    connectionString: databaseUrl,
    ssl: { ca, rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
    application_name: 'night-scout-meta-ads-report-staging',
  });
  try {
    const result = await pool.query('SELECT session_user::text AS session_user, current_user::text AS current_user');
    if (result.rows.length !== 1 || result.rows[0]?.session_user !== role || result.rows[0]?.current_user !== role) throw unavailable();
    return pool;
  } catch {
    try { await pool.end(); } catch { /* keep the generic initialization error */ }
    throw unavailable();
  }
}

function isPinnedReportDatabaseUrl(value) {
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

function dateRange(from, to) {
  const output = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const finish = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= finish) {
    output.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return output;
}

function asDay(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function asTimestamp(value) {
  if (value === null || value === undefined) return null;
  if (!(value instanceof Date) && !isMetaSpendTimestamp(value)) throw unavailable();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw unavailable();
  return date.toISOString();
}

function shapeReportRows(rows, storeId, from, to) {
  const expectedDays = dateRange(from, to);
  if (!Array.isArray(rows) || rows.length !== expectedDays.length || rows.length > 93) throw unavailable();
  // The SQL RPC returns one sentinel row per requested day when there is no
  // active selected account. Active rows carry account metadata and the latest
  // eligible observation for that provider-local day, or a NULL coverage state.
  const missingAccount = rows.every((row) => row.provider_account_id === null);
  if (missingAccount) {
    rows.forEach((row, index) => {
      if (asDay(row.spend_date) !== expectedDays[index]
        || [row.currency,row.timezone_name,row.coverage_state,row.spend_minor,row.observed_at,
          row.run_id,row.run_status,row.run_started_at,row.connection_id,row.account_selection_id,
          row.selected_at,row.connection_status,row.reauthorization_required].some((value) => value !== null)) throw unavailable();
    });
    return Object.freeze({ status: 'not_connected', storeId, from, to, account: null, days: Object.freeze([]) });
  }
  const account = rows[0];
  if (!uuid.test(account.connection_id ?? '') || !uuid.test(account.account_selection_id ?? '')
    || typeof account.selected_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(account.selected_at)
    || !isMetaSpendTimestamp(account.selected_at)
    || !['connected','reauthorization_required'].includes(account.connection_status)
    || typeof account.reauthorization_required !== 'boolean'
    || (account.connection_status === 'reauthorization_required' && !account.reauthorization_required)) throw unavailable();
  if (!accountId.test(account.provider_account_id ?? '') || !/^[A-Z]{3}$/.test(account.currency ?? '')
    || typeof account.timezone_name !== 'string' || account.timezone_name.length < 1 || account.timezone_name.length > 128) throw unavailable();
  try { new Intl.DateTimeFormat('en', { timeZone: account.timezone_name }); } catch { throw unavailable(); }
  const byDay = new Map();
  for (const [index, row] of rows.entries()) {
    if (row.provider_account_id !== account.provider_account_id || row.currency !== account.currency
      || row.timezone_name !== account.timezone_name
      || ['connection_id','account_selection_id','selected_at','connection_status','reauthorization_required']
        .some((key) => row[key] !== account[key])) throw unavailable();
    const day = asDay(row.spend_date);
    if (!validDay(day) || day !== expectedDays[index] || byDay.has(day)) throw unavailable();
    const coverageState = row.coverage_state === null ? 'not_collected' : row.coverage_state;
    if (!['provider_row', 'no_row', 'partial', 'failed', 'not_collected'].includes(coverageState)) throw unavailable();
    const spendMinor = coverageState === 'provider_row' ? decimalString(row.spend_minor) : null;
    if (coverageState !== 'provider_row' && row.spend_minor !== null) throw unavailable();
    const runStatus = row.run_status === null ? null : row.run_status;
    if (runStatus !== null && !['complete', 'partial'].includes(runStatus)) throw unavailable();
    const runId = row.run_id === null ? null : row.run_id;
    if (runId !== null && !uuid.test(runId)) throw unavailable();
    const observedAt = asTimestamp(row.observed_at);
    const runStartedAt = asTimestamp(row.run_started_at);
    if (coverageState === 'not_collected') {
      if ([runId,runStatus,observedAt,runStartedAt].some((value) => value !== null)) throw unavailable();
    } else if (runId === null || runStatus === null || observedAt === null || runStartedAt === null
      || Date.parse(observedAt) < Date.parse(runStartedAt)) throw unavailable();
    byDay.set(day, Object.freeze({
      date: day,
      coverageState,
      spendMinor,
      observedAt,
      runId,
      runStatus,
      runStartedAt,
    }));
  }
  const days = expectedDays.map((day) => byDay.get(day) ?? Object.freeze({
    date: day, coverageState: 'not_collected', spendMinor: null, observedAt: null,
    runId: null, runStatus: null, runStartedAt: null,
  }));
  // Content identity for this coherent read; not a persisted database revision.
  // Exact selected_at text retains PostgreSQL microseconds. Connection health
  // is deliberately excluded so credential expiry cannot rewrite evidence.
  const version = createHash('sha256').update(JSON.stringify({
    storeId, accountId: account.provider_account_id, connectionId: account.connection_id,
    selectionId: account.account_selection_id, selectedAt: account.selected_at, from, to,
    currency: account.currency, timeZone: account.timezone_name, days,
  })).digest('hex');
  return Object.freeze({
    status: 'available', storeId, from, to,
    lineage: Object.freeze({ storeId, accountId: account.provider_account_id, connectionId: account.connection_id, from, to, version: `sha256:${version}` }),
    connectionState: account.reauthorization_required ? 'expired' : 'current',
    reauthorizationRequired: account.reauthorization_required,
    evidenceAvailability: days.some((day) => day.coverageState === 'provider_row') ? 'available' : 'unavailable',
    // No accepted observation-age policy exists; token health is not freshness.
    observationFreshness: 'unknown',
    account: Object.freeze({ providerAccountId: account.provider_account_id, currency: account.currency, timeZone: account.timezone_name }),
    days: Object.freeze(days),
  });
}

function decimalString(value) {
  if (typeof value === 'string' && /^\d{1,30}$/.test(value)) return value;
  if (typeof value === 'bigint' && value >= 0n && value.toString().length <= 30) return value.toString();
  throw unavailable();
}
