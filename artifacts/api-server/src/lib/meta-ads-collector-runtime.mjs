import pg from 'pg';
import { createMetaCredentialEnvelope } from '../../../../experiments/marketing/meta-credential-envelope.mjs';
import { createMetaAdsCollectorRepository } from '../../../../experiments/marketing/meta-ads-repository.mjs';
import { createMetaSpendCollector } from '../../../../experiments/marketing/meta-spend-collector.mjs';

const PROJECT = 'bioalckltvkhlczusdvl';
const DB_HOST = `db.${PROJECT}.supabase.co`;
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com';
const ROLE = 'night_scout_meta_ads_collector_login';
const RPCS = new Set([
  'meta_ads_v1.worker_expire_pending_connections',
  'meta_ads_v1.worker_list_active_accounts',
  'meta_ads_v1.worker_get_selected_account',
  'meta_ads_v1.worker_get_credential_envelope',
  'meta_ads_v1.worker_begin_collection_run',
  'meta_ads_v1.worker_complete_collection_run',
  'meta_ads_v1.worker_fail_collection_run',
]);
const canonical = /^[A-Za-z0-9._-]{1,128}$/;
const unavailable = () => new Error('Meta Ads collector runtime unavailable');

/**
 * Restricted collector worker runtime. It imports no Supabase auth or OAuth
 * protocol, accepts no app secret or owner ID, and is disabled by default.
 */
export async function createMetaAdsCollectorRuntime(env, dependencies = {}) {
  if (env.NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED !== 'true') return undefined;
  const config = readConfig(env);
  const pool = await createPinnedPool(config.databaseUrl, config.ca, dependencies.createPool);
  try {
    const envelope = createMetaCredentialEnvelope(config.masterKey, config.keyVersion);
    const rpc = fixedRpc(pool);
    const { repository, credentialProvider } = createMetaAdsCollectorRepository({
      rpc,
      credentialEnvelope: envelope,
      apiVersion: config.apiVersion,
    });
    const collector = createMetaSpendCollector({
      credentialProvider,
      repository,
      fetchImpl: dependencies.fetchImpl ?? fetch,
    });
    return Object.freeze({
      collector,
      listActiveAccounts: () => repository.listActiveAccounts(new Date().toISOString()),
      expirePendingConnections: () => repository.expirePendingConnections(new Date().toISOString()),
      async close() { await pool.end(); },
    });
  } catch {
    try { await pool.end(); } catch { /* retain the generic initialization failure */ }
    throw unavailable();
  }
}

function readConfig(env) {
  const databaseUrl = env.NIGHT_SCOUT_META_ADS_COLLECTOR_DATABASE_URL;
  const ca = env.NIGHT_SCOUT_STAGING_CA_PEM;
  const masterKey = env.NIGHT_SCOUT_META_ADS_ENVELOPE_MASTER_KEY;
  const keyVersion = env.NIGHT_SCOUT_META_ADS_ENVELOPE_KEY_VERSION;
  const apiVersion = env.NIGHT_SCOUT_META_ADS_API_VERSION;
  if (env.NIGHT_SCOUT_RUNTIME_ENV !== 'staging'
    || env.NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF !== PROJECT
    || !isPinnedDatabaseUrl(databaseUrl)
    || typeof ca !== 'string' || !ca.includes('BEGIN CERTIFICATE') || ca.length > 32_768
    || typeof masterKey !== 'string' || Buffer.byteLength(masterKey) < 32
    || !canonical.test(keyVersion ?? '') || !/^v\d+\.\d+$/.test(apiVersion ?? '')) throw unavailable();
  return Object.freeze({ databaseUrl, ca, masterKey, keyVersion, apiVersion });
}

async function createPinnedPool(databaseUrl, ca, createPool) {
  const pool = (createPool ?? ((options) => new pg.Pool(options)))({
    connectionString: databaseUrl,
    ssl: { ca, rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
    application_name: 'night-scout-meta-ads-collector-staging',
  });
  try {
    const identity = await pool.query('SELECT session_user::text AS session_user, current_user::text AS current_user');
    if (identity.rows.length !== 1 || identity.rows[0]?.session_user !== ROLE || identity.rows[0]?.current_user !== ROLE) {
      throw unavailable();
    }
    return pool;
  } catch {
    try { await pool.end(); } catch { /* retain the generic startup failure */ }
    throw unavailable();
  }
}

function fixedRpc(pool) {
  return Object.freeze({
    async call(name, args) {
      if (!RPCS.has(name) || !Array.isArray(args) || args.length > 16) throw unavailable();
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

function isPinnedDatabaseUrl(value) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const username = decodeURIComponent(url.username);
    const direct = url.hostname === DB_HOST && username === ROLE;
    const sessionPooler = url.hostname === POOLER_HOST && username === `${ROLE}.${PROJECT}`;
    return (url.protocol === 'postgres:' || url.protocol === 'postgresql:')
      && (direct || sessionPooler)
      && (!url.port || url.port === '5432')
      && url.pathname === '/postgres'
      && url.password.length > 0
      && url.search === ''
      && url.hash === '';
  } catch { return false; }
}
