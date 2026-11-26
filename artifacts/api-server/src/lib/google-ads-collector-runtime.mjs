import pg from 'pg';
import { createGoogleAdsOAuthCredentialEnvelope } from '../../../../experiments/marketing/google-ads-oauth-credential-envelope.mjs';
import { createGoogleAdsOAuthProtocol } from '../../../../experiments/marketing/google-ads-oauth-protocol.mjs';
import { createGoogleAdsCollectorRepository } from '../../../../experiments/marketing/google-ads-collector-repository.mjs';
import { createGoogleAdsSpendCollector } from '../../../../experiments/marketing/google-ads-collector.mjs';

const PROJECT = 'bioalckltvkhlczusdvl';
const DB_HOST = `db.${PROJECT}.supabase.co`;
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com';
const ROLE = 'night_scout_google_ads_collector_login';
const RPCS = new Set([
  'google_ads_v1.worker_expire_pending_connections',
  'google_ads_v1.worker_list_active_accounts',
  'google_ads_v1.worker_get_selected_account',
  'google_ads_v1.worker_get_credential_envelope',
  'google_ads_v1.worker_begin_collection_run',
  'google_ads_v1.worker_complete_collection_run',
  'google_ads_v1.worker_fail_collection_run',
]);
const unavailable = () => new Error('Google Ads collector runtime unavailable');

/** Disabled-by-default server worker. It has no Supabase browser auth and no
 * schedule; an external one-off command must opt in explicitly. */
export async function createGoogleAdsCollectorRuntime(env, dependencies = {}) {
  if (env.NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_RUNTIME_ENABLED !== 'true') return undefined;
  const config = readConfig(env);
  const pool = await createPinnedPool(config.databaseUrl, config.ca, dependencies.createPool);
  try {
    const envelope = createGoogleAdsOAuthCredentialEnvelope(config.masterKey, config.keyVersion);
    const protocol = createGoogleAdsOAuthProtocol({
      clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri,
    }, dependencies.fetchImpl ?? fetch);
    const repository = createGoogleAdsCollectorRepository({ rpc: fixedRpc(pool), credentialEnvelope: envelope, apiVersion: 'v26' });
    const credentialProvider = Object.freeze({
      getSelectedAccount: (input) => repository.getSelectedAccount(input),
      async getAccessToken(input) {
        const stored = await repository.getCredentialEnvelope(input);
        if (stored.credentialExpiresAt && Date.parse(stored.credentialExpiresAt) <= Date.now()) throw unavailable();
        let refreshToken;
        try {
          refreshToken = envelope.decrypt({
            connectionId: stored.connectionId, storeId: stored.storeId,
            ciphertext: stored.ciphertext, encryptedDek: stored.encryptedDek,
            storedAlgorithm: stored.algorithm, storedKeyVersion: stored.keyVersion,
          });
          const refreshed = await protocol.refreshAccessToken(refreshToken);
          if (!refreshed || typeof refreshed.accessToken !== 'string' || !Array.isArray(refreshed.grantedScopes)
            // Google may omit scope on refresh when it is unchanged. The
            // protocol permits omission only on refresh; any reported scope
            // must still be exactly the Ads scope.
            || (refreshed.grantedScopes.length !== 0 && (refreshed.grantedScopes.length !== 1
              || refreshed.grantedScopes[0] !== 'https://www.googleapis.com/auth/adwords'))
            || typeof refreshed.expiresAt !== 'string' || !Number.isFinite(Date.parse(refreshed.expiresAt))) throw unavailable();
          return Object.freeze({ accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt });
        } catch { throw unavailable(); }
        finally { refreshToken = undefined; }
      },
    });
    const collector = createGoogleAdsSpendCollector({
      credentialProvider,
      repository,
      apiVersion: 'v26',
      reader: dependencies.reader,
      now: dependencies.now,
    });
    return Object.freeze({
      collector,
      listActiveAccounts: () => repository.listActiveAccounts(new Date().toISOString()),
      expirePendingConnections: () => repository.expirePendingConnections(new Date().toISOString()),
      async close() { await pool.end(); },
    });
  } catch {
    try { await pool.end(); } catch { /* retain the generic startup failure */ }
    throw unavailable();
  }
}

function readConfig(env) {
  const databaseUrl = env.NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_DATABASE_URL;
  const ca = env.NIGHT_SCOUT_STAGING_CA_PEM;
  const masterKey = env.NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_MASTER_KEY;
  const keyVersion = env.NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_KEY_VERSION;
  const clientId = env.NIGHT_SCOUT_GOOGLE_ADS_CLIENT_ID;
  const clientSecret = env.NIGHT_SCOUT_GOOGLE_ADS_CLIENT_SECRET;
  const redirectUri = env.NIGHT_SCOUT_GOOGLE_ADS_REDIRECT_URI;
  if (env.NIGHT_SCOUT_RUNTIME_ENV !== 'staging' || env.NIGHT_SCOUT_GOOGLE_ADS_STAGING_PROJECT_REF !== PROJECT
    || !isPinnedDatabaseUrl(databaseUrl) || typeof ca !== 'string' || !ca.includes('BEGIN CERTIFICATE') || ca.length > 32_768
    || typeof masterKey !== 'string' || Buffer.byteLength(masterKey) < 32 || Buffer.byteLength(masterKey) > 4096
    || typeof keyVersion !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(keyVersion)
    || typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{20,256}\.apps\.googleusercontent\.com$/.test(clientId)
    || typeof clientSecret !== 'string' || clientSecret.length < 8 || clientSecret.length > 512
    || redirectUri !== 'https://night-scout-xero-staging.onrender.com/api/google-ads/callback') throw unavailable();
  return Object.freeze({ databaseUrl, ca, masterKey, keyVersion, clientId, clientSecret, redirectUri });
}

async function createPinnedPool(databaseUrl, ca, createPool) {
  const pool = (createPool ?? ((options) => new pg.Pool(options)))({
    connectionString: databaseUrl, ssl: { ca, rejectUnauthorized: true }, max: 1,
    connectionTimeoutMillis: 10_000, query_timeout: 10_000,
    application_name: 'night-scout-google-ads-collector-staging',
  });
  try {
    const identity = await pool.query('SELECT session_user::text AS session_user, current_user::text AS current_user');
    if (identity.rows.length !== 1 || identity.rows[0]?.session_user !== ROLE || identity.rows[0]?.current_user !== ROLE) throw unavailable();
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
      try { return (await pool.query(`SELECT * FROM ${name}(${placeholders})`, args)).rows; }
      catch { throw unavailable(); }
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
    return (url.protocol === 'postgres:' || url.protocol === 'postgresql:') && (direct || sessionPooler)
      && (!url.port || url.port === '5432') && url.pathname === '/postgres' && url.password.length > 0
      && !url.search && !url.hash;
  } catch { return false; }
}
