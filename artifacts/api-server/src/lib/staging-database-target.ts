const STAGING_PROJECT_REF = 'bioalckltvkhlczusdvl';
const STAGING_SESSION_POOLER = 'aws-1-eu-west-1.pooler.supabase.com';

export type StagingDatabaseRole =
  | 'night_scout_import_login'
  | 'night_scout_xero_bootstrap_login';

/**
 * Accepts only the fixed Night Scout staging direct endpoint or its
 * dashboard-verified Supabase session pooler. The pooler wire username must
 * retain the project suffix; PostgreSQL exposes the underlying restricted
 * role as session_user. Transaction-pooler port 6543 and URL options are
 * deliberately rejected.
 */
export function isPinnedStagingDatabaseUrl(
  value: unknown,
  role: StagingDatabaseRole,
): value is string {
  if (typeof value !== 'string' || value.length < 20 || value.length > 4096) {
    return false;
  }

  try {
    const url = new URL(value);
    const username = decodeURIComponent(url.username);
    const direct =
      url.hostname === `db.${STAGING_PROJECT_REF}.supabase.co` &&
      username === role;
    const sessionPooler =
      url.hostname === STAGING_SESSION_POOLER &&
      username === `${role}.${STAGING_PROJECT_REF}`;

    return (
      (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
      (direct || sessionPooler) &&
      (!url.port || url.port === '5432') &&
      url.pathname === '/postgres' &&
      url.password.length > 0 &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

