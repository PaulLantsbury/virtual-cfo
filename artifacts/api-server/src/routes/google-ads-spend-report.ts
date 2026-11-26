import {isGoogleAdsReportTimestamp} from '../../../../experiments/marketing/google-ads-report-timestamp.mjs';
import { Router, type IRouter } from 'express';

type GoogleIdentity = Readonly<{ userId: string }>;
type ReportService = Readonly<{
  readSpend(identity: GoogleIdentity, input: Readonly<{ storeId: string; from: string; to: string }>): Promise<unknown>;
}>;
type Authenticator = (authorization: string) => Promise<GoogleIdentity> | GoogleIdentity;
export type GoogleAdsSpendReportDependencies = Readonly<{ service?: ReportService; authenticate?: Authenticator }>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const customerIdPattern = /^\d{10}$/;
const currencyPattern = /^[A-Z]{3}$/;
const coverages = new Set(['provider_row', 'no_row', 'partial', 'failed', 'not_collected']);
const runStatuses = new Set(['complete', 'partial']);
const maxInt64 = 9_223_372_036_854_775_807n;
const unavailable = (res: any, status = 503) => res.status(status).json({ error: 'Google Ads spend reporting unavailable' });
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validTimestamp(value: unknown): value is string {
  return isGoogleAdsReportTimestamp(value);
}

function expectedDates(from: string, to: string): string[] {
  const days = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (!Number.isInteger(days) || days < 1 || days > 93) throw new Error('invalid range');
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(`${from}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function validAccount(value: unknown): boolean {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'currency,customerId,timeZone'
    || typeof value.customerId !== 'string' || !customerIdPattern.test(value.customerId)
    || typeof value.currency !== 'string' || !currencyPattern.test(value.currency)
    || typeof value.timeZone !== 'string' || value.timeZone.length < 1 || value.timeZone.length > 128) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { return false; }
  return true;
}

function validDayRecord(value: unknown, expectedDate: string): boolean {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'coverageState,date,observedAt,runId,runStartedAt,runStatus,spendMicros'
    || value.date !== expectedDate || !validDay(value.date) || typeof value.coverageState !== 'string'
    || !coverages.has(value.coverageState)
    || !(value.observedAt === null || validTimestamp(value.observedAt))
    || !(value.runId === null || uuid.test(String(value.runId)))
    || !(value.runStatus === null || typeof value.runStatus === 'string' && runStatuses.has(value.runStatus))
    || !(value.runStartedAt === null || validTimestamp(value.runStartedAt))) return false;

  if (value.coverageState === 'provider_row') {
    if (typeof value.spendMicros !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(value.spendMicros)
      || BigInt(value.spendMicros) > maxInt64) return false;
  } else if (value.spendMicros !== null) return false;

  if (value.coverageState === 'not_collected') {
    return value.observedAt === null && value.runId === null && value.runStatus === null && value.runStartedAt === null;
  }
  return validTimestamp(value.observedAt) && typeof value.runId === 'string' && uuid.test(value.runId)
    && typeof value.runStatus === 'string' && runStatuses.has(value.runStatus)
    && validTimestamp(value.runStartedAt);
}

function validReport(value: unknown, storeId: string, from: string, to: string): boolean {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'account,days,from,status,storeId,to'
    || value.storeId !== storeId || value.from !== from || value.to !== to || !Array.isArray(value.days)) return false;
  const dates = expectedDates(from, to);
  if (value.status === 'not_connected') return value.account === null && value.days.length === 0;
  if (value.status !== 'available' || !validAccount(value.account) || value.days.length !== dates.length) return false;
  return value.days.every((entry, index) => validDayRecord(entry, dates[index]!));
}

/** Authenticated store-scoped read. Customer ID, currency and timezone come only from the service record. */
export function createGoogleAdsSpendReportRouter(dependencies: GoogleAdsSpendReportDependencies = {}): IRouter {
  const router = Router();
  const { service, authenticate } = dependencies;
  router.use('/spend', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    if (!service || !authenticate) return unavailable(res);
    next();
  });
  router.get('/spend', async (req, res) => {
    const query = req.query as Record<string, unknown>;
    if (!query || typeof query !== 'object' || Array.isArray(query)
      || Object.keys(query).sort().join(',') !== 'from,storeId,to'
      || typeof query.storeId !== 'string' || !uuid.test(query.storeId)
      || !validDay(query.from) || !validDay(query.to) || query.from > query.to) return unavailable(res, 400);
    let dates: string[];
    try { dates = expectedDates(query.from, query.to); } catch { return unavailable(res, 400); }
    if (dates.length > 93) return unavailable(res, 400);

    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string' || authorization.length > 8192 || !/^Bearer [^\s,]+$/i.test(authorization)) return unavailable(res, 401);
    let identity: GoogleIdentity;
    try { identity = await authenticate!(authorization); } catch { return unavailable(res, 401); }
    if (!plain(identity) || typeof identity.userId !== 'string' || !uuid.test(identity.userId)) return unavailable(res, 401);

    try {
      const value = await service!.readSpend(identity, Object.freeze({ storeId: query.storeId, from: query.from, to: query.to }));
      if (!validReport(value, query.storeId, query.from, query.to)) return unavailable(res);
      return res.status(200).json(value);
    } catch { return unavailable(res, 404); }
  });
  return router;
}
