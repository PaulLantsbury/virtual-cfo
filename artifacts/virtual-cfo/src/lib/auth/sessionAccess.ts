export type SessionInput = { access_token: string; expires_at?: number; user: { id: string } } | null;
export type Store = { id: string; name: string };
export type AccessState = {
  status: 'checking' | 'signed-out' | 'error' | 'no-store' | 'choose-store' | 'ready';
  userId: string | null; stores: Store[]; storeId: string | null; revision: number;
};
type Dependencies = {
  verify: (token: string) => Promise<string>;
  stores: (userId: string) => Promise<Store[]>;
  clear: () => void;
  now?: () => number;
};

// UI access gate only. Supabase must enforce the same membership using RLS.
export function createSessionAccess(deps: Dependencies) {
  let state: AccessState = { status: 'checking', userId: null, stores: [], storeId: null, revision: 0 };
  let version = 0;
  let expiresAt = 0;
  const listeners = new Set<() => void>();
  const now = deps.now ?? Date.now;
  const publish = (next: AccessState) => { state = next; listeners.forEach(fn => fn()); };
  const reset = (status: AccessState['status']) => {
    version++; expiresAt = 0; deps.clear();
    publish({ status, userId: null, stores: [], storeId: null, revision: version });
  };
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    clear: () => reset('signed-out'),
    fail: () => reset('error'),
    expire: () => { if (expiresAt && now() >= expiresAt) reset('signed-out'); },
    async setSession(session: SessionInput) {
      reset(session ? 'checking' : 'signed-out');
      const request = version;
      if (!session) return;
      if (!Number.isFinite(session.expires_at) || !session.expires_at || session.expires_at * 1000 <= now()) { reset('signed-out'); return; }
      expiresAt = session.expires_at * 1000;
      try {
        const userId = await deps.verify(session.access_token);
        if (request !== version) return;
        if (userId !== session.user.id) throw new Error('Identity mismatch');
        const stores = await deps.stores(userId);
        if (request !== version) return;
        if (now() >= expiresAt) { reset('signed-out'); return; }
        if (stores.some(s => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id)) || new Set(stores.map(s => s.id)).size !== stores.length) throw new Error('Invalid membership result');
        publish({ status: stores.length === 1 ? 'ready' : stores.length ? 'choose-store' : 'no-store', userId, stores, storeId: stores.length === 1 ? stores[0].id : null, revision: request });
      } catch {
        if (request === version) reset('error');
      }
    },
    select(storeId: string) {
      if (!expiresAt || now() >= expiresAt) { reset('signed-out'); return; }
      if (!state.userId || !state.stores.some(s => s.id === storeId)) throw new Error('Store is not authorised');
      deps.clear(); version++;
      publish({ ...state, status: 'ready', storeId, revision: version });
    },
  };
}
