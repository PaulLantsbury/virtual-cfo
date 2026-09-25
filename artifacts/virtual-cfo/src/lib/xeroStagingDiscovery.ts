const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE = /^[A-Za-z0-9_-]{24,160}$/;

type Fetcher = typeof fetch;

export type XeroDiscoveryAccount = Readonly<{
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
}>;

export type XeroDiscovery = Readonly<{
  handle: string;
  status: 'pending' | 'ready';
  selectionHandle?: string;
  tenant?: Readonly<{ id: string; name: string }>;
  accounts?: readonly XeroDiscoveryAccount[];
}>;

export const XERO_MAPPING_CATEGORIES = ['revenue', 'processingFee', 'advertising', 'software', 'includedCash'] as const;
export type XeroMappingCategory = typeof XERO_MAPPING_CATEGORIES[number];
export type XeroBootstrapMapping = Readonly<Record<XeroMappingCategory, readonly string[]>>;
export type XeroBootstrapSelection = Readonly<{selectionHandle:string;effectiveFrom:string;mapping:XeroBootstrapMapping}>;
const ALLOWED_TYPES: Readonly<Record<XeroMappingCategory, ReadonlySet<string>>> = Object.freeze({
  revenue: new Set(['REVENUE', 'SALES']), processingFee: new Set(['OVERHEADS', 'EXPENSE']),
  advertising: new Set(['OVERHEADS', 'EXPENSE']), software: new Set(['OVERHEADS', 'EXPENSE']), includedCash: new Set(['BANK']),
});

const plain = (value: unknown): value is Record<string, unknown> => value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;

export function parseXeroDiscoveryStart(value: unknown): Readonly<{ url: string }> | null {
  if (!plain(value) || Object.keys(value).some(key => key !== 'url') || !text(value.url, 8192)) return null;
  try {
    const url = new URL(value.url);
    if (url.protocol !== 'https:' || url.hostname !== 'login.xero.com') return null;
    return Object.freeze({ url: url.toString() });
  } catch { return null; }
}

export function parseXeroDiscovery(value: unknown, expectedHandle: string): XeroDiscovery | null {
  if (!HANDLE.test(expectedHandle) || !plain(value)) return null;
  if (Object.keys(value).some(key => !['handle', 'status', 'selectionHandle', 'tenant', 'accounts'].includes(key))) return null;
  if (value.handle !== expectedHandle || (value.status !== 'pending' && value.status !== 'ready')) return null;
  if (value.status === 'pending') {
    if ('selectionHandle' in value || 'tenant' in value || 'accounts' in value) return null;
    return Object.freeze({ handle: expectedHandle, status: 'pending' });
  }
  if (!HANDLE.test(String(value.selectionHandle)) || !plain(value.tenant) || Object.keys(value.tenant).some(key => !['id', 'name'].includes(key))
    || !UUID.test(String(value.tenant.id)) || !text(value.tenant.name, 256) || !Array.isArray(value.accounts)
    || value.accounts.length > 500) return null;
  const accounts: XeroDiscoveryAccount[] = [];
  for (const account of value.accounts) {
    if (!plain(account) || Object.keys(account).some(key => !['id', 'code', 'name', 'type', 'status'].includes(key))
      || !UUID.test(String(account.id)) || (account.code !== null && (typeof account.code !== 'string' || account.code.length > 256))
      || !text(account.name, 256) || !text(account.type, 256) || !text(account.status, 256)) return null;
    accounts.push(Object.freeze({ id: String(account.id), code: account.code as string | null, name: account.name, type: account.type, status: account.status }));
  }
  return Object.freeze({
    handle: expectedHandle,
    status: 'ready',
    selectionHandle: String(value.selectionHandle),
    tenant: Object.freeze({ id: String(value.tenant.id), name: value.tenant.name }),
    accounts: Object.freeze(accounts),
  });
}

function day(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    && value >= '2000-01-01' && value <= new Date().toISOString().slice(0, 10);
}

export function accountCanMapTo(account: XeroDiscoveryAccount, category: XeroMappingCategory): boolean {
  return account.status === 'ACTIVE' && ALLOWED_TYPES[category].has(account.type);
}

export function validateXeroBootstrapSelection(discovery: XeroDiscovery, effectiveFrom: string, mapping: Record<XeroMappingCategory, readonly string[]>): XeroBootstrapSelection | null {
  if (discovery.status !== 'ready' || !HANDLE.test(discovery.selectionHandle ?? '') || !discovery.accounts || !day(effectiveFrom)) return null;
  const directory = new Map(discovery.accounts.map(account => [account.id, account]));
  const used = new Set<string>();
  const result = {} as Record<XeroMappingCategory, readonly string[]>;
  for (const category of XERO_MAPPING_CATEGORIES) {
    const ids = mapping[category];
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20 || new Set(ids).size !== ids.length) return null;
    for (const id of ids) {
      const account = directory.get(id);
      if (!account || used.has(id) || !accountCanMapTo(account, category)) return null;
      used.add(id);
    }
    result[category] = Object.freeze([...ids]);
  }
  return Object.freeze({ selectionHandle: discovery.selectionHandle!, effectiveFrom, mapping: Object.freeze(result) });
}

function bearer(accessToken: string): Record<string, string> {
  if (!text(accessToken, 8192) || /\s/.test(accessToken)) throw Error('Xero discovery sign-in required');
  return { accept: 'application/json', authorization: `Bearer ${accessToken}` };
}

export async function startXeroStagingDiscovery(accessToken: string, fetcher: Fetcher = fetch): Promise<Readonly<{ url: string }>> {
  const response = await fetcher('/api/xero/staging/discover', {
    method: 'POST', credentials: 'include', cache: 'no-store', headers: bearer(accessToken),
  });
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Xero discovery owner sign-in required' : 'Xero discovery unavailable');
  const parsed = parseXeroDiscoveryStart(await response.json());
  if (!parsed) throw Error('Xero discovery unavailable');
  return parsed;
}

export async function fetchXeroStagingDiscovery(handle: string, accessToken: string, signal?: AbortSignal, fetcher: Fetcher = fetch): Promise<XeroDiscovery> {
  if (!HANDLE.test(handle)) throw Error('Xero discovery unavailable');
  const response = await fetcher(`/api/xero/staging/discovery/${encodeURIComponent(handle)}`, {
    credentials: 'include', cache: 'no-store', signal, headers: bearer(accessToken),
  });
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Xero discovery owner sign-in required' : 'Xero discovery unavailable');
  const parsed = parseXeroDiscovery(await response.json(), handle);
  if (!parsed) throw Error('Xero discovery unavailable');
  return parsed;
}

export async function startXeroStagingBootstrap(selection: XeroBootstrapSelection, accessToken: string, fetcher: Fetcher = fetch): Promise<Readonly<{url:string}>> {
  if (!HANDLE.test(selection.selectionHandle) || !day(selection.effectiveFrom)) throw Error('Xero mapping is incomplete');
  const response = await fetcher('/api/xero/staging/connect', {
    method: 'POST', credentials: 'include', cache: 'no-store',
    headers: { ...bearer(accessToken), 'content-type': 'application/json' }, body: JSON.stringify(selection),
  });
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Xero connection owner sign-in required' : 'Xero connection unavailable');
  const parsed = parseXeroDiscoveryStart(await response.json());
  if (!parsed) throw Error('Xero connection unavailable');
  return parsed;
}
