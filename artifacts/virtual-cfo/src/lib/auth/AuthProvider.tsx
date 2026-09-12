import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { createSessionAccess, type AccessState, type SessionInput } from './sessionAccess';

type AuthContextValue = AccessState & { select: (id: string) => void; retry: () => void; signOut: () => Promise<void>; signOutError: boolean; beginSignIn: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const blocked = useRef(false);
  const [signOutError, setSignOutError] = useState(false);
  const access = useMemo(() => createSessionAccess({
    clear: () => { void cache.cancelQueries(); cache.clear(); },
    verify: async token => {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) throw new Error('Session could not be verified');
      return data.user.id;
    },
    stores: async userId => {
      const { data, error } = await supabase.from('store_memberships').select('store_id, stores(id, name)').eq('user_id', userId);
      if (error || !data) throw new Error('Store access unavailable');
      return data.map(row => {
        const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
        if (!store || store.id !== row.store_id) throw new Error('Store access unavailable');
        return { id: row.store_id, name: store.name || 'Your store' };
      });
    },
  }), [cache]);
  const state = useSyncExternalStore(access.subscribe, access.getSnapshot, access.getSnapshot);
  useEffect(() => {
    let alive = true, eventVersion = 0;
    const accept = (session: SessionInput) => { if (alive && !blocked.current) void access.setSession(session); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      eventVersion++;
      if (event === 'SIGNED_IN' && !blocked.current) setSignOutError(false);
      // Clear protected views synchronously; perform SDK calls outside its auth callback.
      access.clear();
      const current = eventVersion;
      setTimeout(() => { if (current === eventVersion) accept(session); }, 0);
    });
    const initial = eventVersion;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive || initial !== eventVersion) return;
      if (error) access.fail(); else accept(data.session);
    }).catch(() => { if (alive && initial === eventVersion) access.fail(); });
    const timer = setInterval(() => access.expire(), 1000);
    const recheck = () => {
      access.expire();
      if (document.visibilityState === 'visible' && !blocked.current) {
        const current = eventVersion;
        access.clear();
        void supabase.auth.getSession().then(({data,error}) => {
          if (!alive || current !== eventVersion) return;
          if(error) access.fail(); else accept(data.session);
        }).catch(() => { if(alive && current === eventVersion) access.fail(); });
      }
    };
    document.addEventListener('visibilitychange', recheck);
    return () => { alive = false; eventVersion++; subscription.unsubscribe(); clearInterval(timer); document.removeEventListener('visibilitychange', recheck); access.clear(); };
  }, [access]);
  const retry = () => {
    // A full reload revalidates the SDK session and cancels any old page requests.
    window.location.reload();
  };
  const signOut = async () => {
    blocked.current = true; setSignOutError(false); access.clear();
    try { const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) setSignOutError(true); }
    catch { setSignOutError(true); }
  };
  return <AuthContext.Provider value={{ ...state, select: access.select, retry, signOut, signOutError, beginSignIn: () => { blocked.current = false; setSignOutError(false); access.clear(); } }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required');
  return auth;
}
export function useActiveStore() {
  const auth = useAuth();
  if (auth.status !== 'ready' || !auth.storeId) throw new Error('Store access has not been resolved');
  return auth.storeId;
}
