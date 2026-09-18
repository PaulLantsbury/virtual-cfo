export type XeroMerchantConnection = Readonly<{
  id: string;
  storeId: string;
  tenantId: string;
  status: 'active' | 'reauthorization_required' | 'disconnected';
  scopeVersion: 'read-only-v1';
  createdAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  mappingReviewRequired: boolean;
}>;

export type XeroMerchantSetupState = Readonly<{
  title: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'positive';
  canStartConnection: boolean;
  canReviewMapping: boolean;
}>;

const id = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

/**
 * Strict, value-free browser boundary for the future authenticated connection
 * endpoint. OAuth credentials, reports and balances never cross this shape.
 */
export function parseXeroMerchantConnection(value: unknown): XeroMerchantConnection | null {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'createdAt,id,lastFailureAt,lastSuccessAt,mappingReviewRequired,scopeVersion,status,storeId,tenantId') return null;
  if (!id(value.id) || !id(value.storeId) || !id(value.tenantId) || !['active', 'reauthorization_required', 'disconnected'].includes(String(value.status)) || value.scopeVersion !== 'read-only-v1' || !timestamp(value.createdAt) || !(value.lastSuccessAt === null || timestamp(value.lastSuccessAt)) || !(value.lastFailureAt === null || timestamp(value.lastFailureAt)) || typeof value.mappingReviewRequired !== 'boolean') return null;
  return Object.freeze({ id: value.id as string, storeId: value.storeId as string, tenantId: value.tenantId as string, status: value.status as XeroMerchantConnection['status'], scopeVersion: 'read-only-v1', createdAt: value.createdAt as string, lastSuccessAt: value.lastSuccessAt as string | null, lastFailureAt: value.lastFailureAt as string | null, mappingReviewRequired: value.mappingReviewRequired });
}

/** Safe UX state: only an active, read-only connection can enter mapping review. */
export function xeroMerchantSetupState(connection: XeroMerchantConnection | null, environmentEnabled: boolean): XeroMerchantSetupState {
  if (!environmentEnabled) return Object.freeze({ title: 'Merchant connection is not enabled here', detail: 'This environment keeps the Xero prototype disconnected. Local test mapping remains separate and no credentials or accounting figures are retained.', tone: 'neutral', canStartConnection: false, canReviewMapping: false });
  if (!connection) return Object.freeze({ title: 'Connect Xero', detail: 'An account owner can start a read-only Xero connection. You will choose the Xero organisation before mapping accounts.', tone: 'neutral', canStartConnection: true, canReviewMapping: false });
  if (connection.status === 'reauthorization_required') return Object.freeze({ title: 'Xero needs reconnection', detail: 'An account owner must reconnect Xero before Night Scout can refresh mapping or accounting evidence.', tone: 'warning', canStartConnection: true, canReviewMapping: false });
  if (connection.status === 'disconnected') return Object.freeze({ title: 'Xero is disconnected', detail: 'No Xero credential is available. An account owner may begin a new read-only connection.', tone: 'warning', canStartConnection: true, canReviewMapping: false });
  if (connection.mappingReviewRequired) return Object.freeze({ title: 'Review Xero mapping', detail: 'An account owner must confirm the current account mapping before accounting evidence can be used.', tone: 'warning', canStartConnection: false, canReviewMapping: true });
  return Object.freeze({ title: 'Xero mapping confirmed', detail: 'The read-only Xero connection and current mapping are ready for a future accounting refresh.', tone: 'positive', canStartConnection: false, canReviewMapping: true });
}
