const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGIN = 'https://night-scout-xero-staging.onrender.com';
export function writerConsentVisible(input: { enabled?: string; ownerId?: string; configuredStoreId?: string; userId: string | null; storeId: string | null; origin: string }): boolean {
  return input.enabled === 'true' && input.origin === ORIGIN && UUID.test(input.ownerId ?? '') && UUID.test(input.configuredStoreId ?? '')
    && input.userId === input.ownerId && input.storeId === input.configuredStoreId;
}

/** Starts consent only; no invoice or programme enablement is requested here. */
export async function startXeroTestWriterConsent(accessToken: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!accessToken || accessToken.length > 8192 || /\s/.test(accessToken)) throw Error('Sign in again before connecting the Xero test writer.');
  const response = await fetcher('/api/xero/test-writer/connect', {
    method: 'POST', credentials: 'include', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: '{}',
  });
  if (!response.ok) throw Error('The Xero test writer is not ready. Its separate staging credentials must be configured first.');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).length !== 1 || !('url' in result) || typeof result.url !== 'string' || result.url.length > 8192) throw Error('Xero test-writer consent is unavailable.');
  const url = new URL(result.url);
  if (url.origin !== 'https://login.xero.com' || url.pathname !== '/identity/connect/authorize' || url.username || url.password || url.hash
    || url.searchParams.get('response_type') !== 'code' || url.searchParams.get('redirect_uri') !== `${ORIGIN}/api/xero/test-writer/callback`) throw Error('Xero test-writer consent is unavailable.');
  return url.toString();
}
