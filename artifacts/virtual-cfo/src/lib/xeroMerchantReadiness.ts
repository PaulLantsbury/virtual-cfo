import { parseXeroMerchantConnection, type XeroMerchantConnection } from './xeroMerchantConnection.ts';

/**
 * The only Xero evidence shape allowed into the browser before accounting
 * figures are supported. It deliberately carries state, scope and freshness
 * information only: credentials, raw reports and financial amounts stay on
 * the server.
 */
export type XeroMerchantEvidenceState = 'checking' | 'ready' | 'stale' | 'review_required' | 'unavailable' | 'denied';

export type XeroMerchantReadiness = Readonly<{
  storeId: string;
  connection: XeroMerchantConnection | null;
  evidenceState: XeroMerchantEvidenceState | null;
  evidenceAsOf: string | null;
}>;

export type XeroMerchantReadinessView = Readonly<{
  title: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'positive';
  canUseAccountingEvidence: boolean;
}>;

const id = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const timestamp = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

/** Rejects extra fields so a future server cannot accidentally add values or credentials to this browser boundary. */
export function parseXeroMerchantReadiness(value: unknown): XeroMerchantReadiness | null {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'connection,evidenceAsOf,evidenceState,storeId') return null;
  if (!id(value.storeId) || !(value.connection === null || parseXeroMerchantConnection(value.connection)) || !(value.evidenceState === null || ['checking', 'ready', 'stale', 'review_required', 'unavailable', 'denied'].includes(String(value.evidenceState))) || !(value.evidenceAsOf === null || timestamp(value.evidenceAsOf))) return null;
  if (value.connection !== null && parseXeroMerchantConnection(value.connection)!.storeId !== value.storeId) return null;
  if (value.evidenceState === 'ready' && !timestamp(value.evidenceAsOf)) return null;
  return Object.freeze({ storeId: value.storeId as string, connection: value.connection === null ? null : parseXeroMerchantConnection(value.connection)!, evidenceState: value.evidenceState as XeroMerchantEvidenceState | null, evidenceAsOf: value.evidenceAsOf as string | null });
}

/** Fail closed: an active, owner-confirmed mapping and current dated evidence are all required. */
export function xeroMerchantReadinessView(readiness: XeroMerchantReadiness | null, enabled: boolean): XeroMerchantReadinessView {
  if (!enabled) return Object.freeze({ title: 'Xero staging reporting is not enabled here', detail: 'This environment does not load merchant Xero evidence. Local test mapping remains separate.', tone: 'neutral', canUseAccountingEvidence: false });
  if (!readiness || !readiness.connection) return Object.freeze({ title: 'Connect Xero', detail: 'An account owner must complete a read-only Xero connection before accounting evidence can be used.', tone: 'neutral', canUseAccountingEvidence: false });
  if (readiness.connection.status !== 'active') return Object.freeze({ title: 'Xero needs reconnection', detail: 'The read-only Xero connection is not active. Accounting and cash figures remain unavailable.', tone: 'warning', canUseAccountingEvidence: false });
  if (readiness.connection.mappingReviewRequired) return Object.freeze({ title: 'Review Xero mapping', detail: 'An owner must confirm the current mapping before Night Scout can use accounting evidence.', tone: 'warning', canUseAccountingEvidence: false });
  switch (readiness.evidenceState) {
    case 'ready': return Object.freeze({ title: 'Xero accounting evidence is available', detail: `Current dated evidence is available as of ${readiness.evidenceAsOf}. Xero-reported accounting amounts remain separate from Shopify.`, tone: 'positive', canUseAccountingEvidence: true });
    case 'checking': return Object.freeze({ title: 'Checking Xero accounting evidence', detail: 'Accounting and cash figures remain unavailable until the refresh and scope checks complete.', tone: 'neutral', canUseAccountingEvidence: false });
    case 'stale': return Object.freeze({ title: 'Xero evidence may be out of date', detail: 'The latest refresh did not complete. A retained same-store snapshot must not be presented as current.', tone: 'warning', canUseAccountingEvidence: false });
    case 'review_required': return Object.freeze({ title: 'Xero evidence needs review', detail: 'A later posting, mapping change or source change requires review before accounting figures can be presented as current.', tone: 'warning', canUseAccountingEvidence: false });
    case 'denied': return Object.freeze({ title: 'Xero evidence is not accessible', detail: 'You do not have access to this store’s accounting evidence. Evidence from another store is never substituted.', tone: 'warning', canUseAccountingEvidence: false });
    default: return Object.freeze({ title: 'Xero accounting evidence is unavailable', detail: 'No supported accounting evidence is available for this store. Missing figures are not treated as zero.', tone: 'warning', canUseAccountingEvidence: false });
  }
}
