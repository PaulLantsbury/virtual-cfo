type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const key = (userId: string) => `night-scout:selected-store:${userId}`;

/**
 * A store preference is only a convenience hint. AuthProvider always verifies
 * the user's current memberships before accepting it.
 *
 * localStorage is intentional: Xero may return consent in a new browsing
 * context, where sessionStorage would lose the selected store.
 */
export function readStorePreference(storage: Store, userId: string): string | null {
  try { return storage.getItem(key(userId)); } catch { return null; }
}

export function writeStorePreference(storage: Store, userId: string, storeId: string | null): void {
  try {
    if (storeId) storage.setItem(key(userId), storeId);
    else storage.removeItem(key(userId));
  } catch { /* storage must never affect authorised access */ }
}
