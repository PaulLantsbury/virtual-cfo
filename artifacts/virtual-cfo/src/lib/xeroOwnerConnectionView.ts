export type XeroOwnerConnectionStatus = 'active' | 'reauthorization_required' | 'disconnected' | null;

export function xeroOwnerConnectionView(status: XeroOwnerConnectionStatus) {
  if (status === 'reauthorization_required') return Object.freeze({
    reconnecting: true,
    title: 'Reconnect Xero',
    detail: 'Xero no longer authorises this read-only connection. Reconnect as the account owner. Night Scout will verify the same organisation and retain the existing confirmed mapping and history.',
    action: 'Reconnect Xero test account',
  });
  return Object.freeze({
    reconnecting: false,
    title: 'Discover Xero test organisation',
    detail: 'Staging owner tool. Xero consent returns only an opaque, short-lived handle; Night Scout then shows bounded organisation and account-directory metadata for mapping review. It does not display or retain credentials here.',
    action: 'Discover Xero test account',
  });
}
