import { parseXeroMerchantReadiness, type XeroMerchantReadiness } from './xeroMerchantReadiness.ts';
import type { CashControlReadinessInput } from './analytics/cashControlReadiness.ts';

/**
 * Browser boundary for the staging Xero reader. Both endpoints are same-origin,
 * authenticated server endpoints and intentionally accept only a current store
 * id. This module neither knows OAuth credentials nor infers financial values.
 */
const storeId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const states = new Set(['not_connected', 'mapping_incomplete', 'evidence_incomplete', 'review_required', 'stale', 'ready', 'denied']);

/**
 * Contract for GET /api/xero/cash-readiness?storeId=<uuid>.
 * It contains status and scope only. A future amount endpoint must have a
 * distinct exact schema; no amount is accepted through this status route.
 */
export function parseCashControlReadiness(value: unknown): CashControlReadinessInput | null {
  if (!plain(value)) return null;
  const keys = Object.keys(value).sort();
  const allowed = ['asOf', 'detail', 'retainedStoreId', 'state', 'storeId'];
  if (!keys.every(key => allowed.includes(key)) || !keys.includes('state') || !keys.includes('storeId')) return null;
  if (!storeId(value.storeId) || typeof value.state !== 'string' || !states.has(value.state)) return null;
  if ('retainedStoreId' in value && value.retainedStoreId !== null && !storeId(value.retainedStoreId)) return null;
  if ('asOf' in value && value.asOf !== null && !timestamp(value.asOf)) return null;
  if ('detail' in value && value.detail !== null && (typeof value.detail !== 'string' || value.detail.length > 500)) return null;
  // A status endpoint must never mark evidence ready without a date.
  if (value.state === 'ready' && !timestamp(value.asOf)) return null;
  return Object.freeze({
    state: value.state as CashControlReadinessInput['state'], storeId: value.storeId,
    ...(typeof value.retainedStoreId === 'string' ? { retainedStoreId: value.retainedStoreId } : {}),
    ...(typeof value.asOf === 'string' ? { asOf: value.asOf } : {}),
    ...(typeof value.detail === 'string' ? { detail: value.detail } : {}),
  });
}

async function read(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw Error('Xero readiness unavailable');
  return response.json();
}

export async function fetchXeroMerchantReadiness(activeStoreId: string, signal?: AbortSignal): Promise<XeroMerchantReadiness> {
  if (!storeId(activeStoreId)) throw Error('Xero readiness unavailable');
  const parsed = parseXeroMerchantReadiness(await read(`/api/xero/merchant-readiness?storeId=${encodeURIComponent(activeStoreId)}`, signal));
  if (!parsed || parsed.storeId !== activeStoreId) throw Error('Xero readiness unavailable');
  return parsed;
}

export async function fetchCashControlReadiness(activeStoreId: string, signal?: AbortSignal): Promise<CashControlReadinessInput> {
  if (!storeId(activeStoreId)) throw Error('Xero readiness unavailable');
  const parsed = parseCashControlReadiness(await read(`/api/xero/cash-readiness?storeId=${encodeURIComponent(activeStoreId)}`, signal));
  if (!parsed || parsed.storeId !== activeStoreId) throw Error('Xero readiness unavailable');
  return parsed;
}
