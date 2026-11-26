export type GoogleAdsSpendCoverage = 'provider_row' | 'no_row' | 'partial' | 'failed' | 'not_collected';
export type GoogleAdsSpendDay = Readonly<{
  date: string;
  coverageState: GoogleAdsSpendCoverage;
  spendMicros: string | null;
  observedAt: string | null;
  runId: string | null;
  runStatus: 'complete' | 'partial' | null;
  runStartedAt: string | null;
}>;
export type GoogleAdsSpendRange = Readonly<{
  status: 'available';
  storeId: string;
  from: string;
  to: string;
  account: Readonly<{ customerId: string; currency: string; timeZone: string }>;
  days: readonly GoogleAdsSpendDay[];
}>;
export type GoogleAdsSpendResult = GoogleAdsSpendRange | Readonly<{
  status: 'not_connected';
  storeId: string;
  from: string;
  to: string;
  account: null;
  days: readonly [];
}>;
type Dependencies = Readonly<{ fetcher?: typeof fetch; accessToken?: () => Promise<string> }>;

const fail = () => new Error('Google Ads spend unavailable');
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const day = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const timestamp = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const coverages = new Set<GoogleAdsSpendCoverage>(['provider_row', 'no_row', 'partial', 'failed', 'not_collected']);
const statuses = new Set(['complete', 'partial']);
const maxInt64 = 9_223_372_036_854_775_807n;

async function currentAccessToken(): Promise<string> {
  const { supabase } = await import('./supabase.ts');
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  if (error || !session?.access_token || !session.expires_at || session.expires_at * 1000 <= Date.now()) throw fail();
  return session.access_token;
}

function validAccount(value: unknown): value is GoogleAdsSpendRange['account'] {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'currency,customerId,timeZone'
    || typeof value.customerId !== 'string' || !/^\d{10}$/.test(value.customerId)
    || typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)
    || typeof value.timeZone !== 'string' || value.timeZone.length < 1 || value.timeZone.length > 128) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { return false; }
  return true;
}

function parseDay(value: unknown, expectedDate: string): GoogleAdsSpendDay | null {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'coverageState,date,observedAt,runId,runStartedAt,runStatus,spendMicros'
    || value.date !== expectedDate || !day(value.date) || typeof value.coverageState !== 'string'
    || !coverages.has(value.coverageState as GoogleAdsSpendCoverage)
    || !(value.observedAt === null || timestamp(value.observedAt))
    || !(value.runId === null || uuid(value.runId))
    || !(value.runStatus === null || typeof value.runStatus === 'string' && statuses.has(value.runStatus))
    || !(value.runStartedAt === null || timestamp(value.runStartedAt))) return null;
  if (value.coverageState === 'provider_row') {
    if (typeof value.spendMicros !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(value.spendMicros)
      || BigInt(value.spendMicros) > maxInt64) return null;
  } else if (value.spendMicros !== null) return null;
  if (value.coverageState === 'not_collected') {
    if (value.observedAt !== null || value.runId !== null || value.runStatus !== null || value.runStartedAt !== null) return null;
  } else if (!timestamp(value.observedAt) || !uuid(value.runId)
    || typeof value.runStatus !== 'string' || !statuses.has(value.runStatus) || !timestamp(value.runStartedAt)) return null;
  return Object.freeze({
    date: expectedDate,
    coverageState: value.coverageState as GoogleAdsSpendCoverage,
    spendMicros: value.spendMicros as string | null,
    observedAt: value.observedAt as string | null,
    runId: value.runId as string | null,
    runStatus: value.runStatus as GoogleAdsSpendDay['runStatus'],
    runStartedAt: value.runStartedAt as string | null,
  });
}

function parseReport(value: unknown, storeId: string, from: string, to: string): GoogleAdsSpendResult {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'account,days,from,status,storeId,to'
    || value.storeId !== storeId || value.from !== from || value.to !== to || !Array.isArray(value.days)) throw fail();
  const first = Date.parse(`${from}T00:00:00.000Z`);
  const last = Date.parse(`${to}T00:00:00.000Z`);
  const count = (last - first) / 86_400_000 + 1;
  if (!day(from) || !day(to) || from > to || !Number.isInteger(count) || count < 1 || count > 93) throw fail();
  if (value.status === 'not_connected') {
    if (value.account !== null || value.days.length !== 0) throw fail();
    return Object.freeze({ status: 'not_connected', storeId, from, to, account: null, days: Object.freeze([]) as readonly [] });
  }
  if (value.status !== 'available' || !validAccount(value.account) || value.days.length !== count) throw fail();
  const days = value.days.map((record, index) => {
    const expectedDate = new Date(first + index * 86_400_000).toISOString().slice(0, 10);
    return parseDay(record, expectedDate);
  });
  if (days.some((record) => record === null)) throw fail();
  return Object.freeze({ status: 'available', storeId, from, to, account: value.account, days: Object.freeze(days as GoogleAdsSpendDay[]) });
}

export async function fetchGoogleAdsSpendRange(
  storeId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
  dependencies: Dependencies = {},
): Promise<GoogleAdsSpendResult> {
  if (!uuid(storeId) || !day(from) || !day(to) || from > to
    || (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 > 92) throw fail();
  const token = await (dependencies.accessToken ?? currentAccessToken)();
  if (typeof token !== 'string' || token.length < 1 || token.length > 8192 || /\s/.test(token)) throw fail();
  const query = new URLSearchParams({ storeId, from, to });
  const response = await (dependencies.fetcher ?? fetch)(`/api/google-ads/spend?${query}`, {
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw fail();
  let body: unknown;
  try { body = await response.json(); } catch { throw fail(); }
  return parseReport(body, storeId, from, to);
}
