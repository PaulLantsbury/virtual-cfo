import {parseXeroAccountingPeriod, validXeroScope, type XeroAccountingPeriod, type XeroAccountingScope} from '../../../api-server/src/lib/xero-accounting-reader.ts';
export type {XeroAccountingPeriod, XeroAccountingScope};
export type XeroAccountingDependencies = Readonly<{fetcher?: typeof fetch; accessToken?: () => Promise<string>}>;
async function accessToken() {
  const {supabase} = await import('./supabase.ts');
  const {data, error} = await supabase.auth.getSession();
  const session = data.session;
  if (error || !session?.access_token || !session.expires_at || session.expires_at * 1000 <= Date.now()) throw Error('Xero accounting unavailable');
  return session.access_token;
}
export async function fetchXeroAccountingPeriod(scope: XeroAccountingScope, signal?: AbortSignal, deps: XeroAccountingDependencies = {}): Promise<XeroAccountingPeriod> {
  if (!validXeroScope(scope)) throw Error('Xero accounting unavailable');
  const token = await (deps.accessToken ?? accessToken)();
  if (typeof token !== 'string' || !token.length || token.length > 8192 || /\s/.test(token)) throw Error('Xero accounting unavailable');
  signal?.throwIfAborted();
  const params = new URLSearchParams(scope);
  const response = await (deps.fetcher ?? fetch)(`/api/xero/accounting-period?${params}`, {
    credentials: 'include', cache: 'no-store', signal,
    headers: {accept: 'application/json', authorization: `Bearer ${token}`},
  });
  if (!response.ok) throw Error('Xero accounting unavailable');
  const result = parseXeroAccountingPeriod(await response.json(), scope);
  if (!result) throw Error('Xero accounting unavailable');
  return result;
}
