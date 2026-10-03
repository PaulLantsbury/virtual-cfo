import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';

export function StoreAccessGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'ready') return <div key={auth.revision} className="flex h-dvh flex-col">
    <div className="shrink-0 flex items-center justify-end gap-3 border-b bg-background px-4 py-2 text-sm">
      <label>Store <select aria-label="Active store" className="ml-2 rounded border p-1" value={auth.storeId!} onChange={e => auth.select(e.target.value)}>
        {auth.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
      </select></label>
      <Button size="sm" variant="outline" onClick={() => void auth.signOut()}>Sign out</Button>
    </div><div className="min-h-0 flex-1">{children}</div>
  </div>;
  return <main className="min-h-screen flex items-center justify-center p-6"><div className="w-full max-w-md space-y-4" aria-live="polite">
    <h1 className="text-2xl font-semibold">{auth.status === 'checking' ? 'Checking your access…' : auth.status === 'signed-out' ? 'Sign in to Night Scout' : auth.status === 'choose-store' ? 'Choose your store' : auth.status === 'no-store' ? 'Your account is not linked to a store yet' : 'We could not verify your store access'}</h1>
    {auth.status === 'signed-out' && <Link href="/login" className="text-primary underline">Go to sign in</Link>}
    {auth.status === 'no-store' && <p>Ask your administrator to link your account, then check again.</p>}
    {auth.status === 'error' && <p>Please try again. Your store data will stay hidden until access is confirmed.</p>}
    {auth.status === 'choose-store' && auth.stores.map(store => <Button className="w-full" key={store.id} onClick={() => auth.select(store.id)}>{store.name}</Button>)}
    {auth.signOutError && <p role="alert">Sign-out could not finish. Your data is hidden; please retry signing out.</p>}
    {['error','no-store'].includes(auth.status) && <Button variant="outline" onClick={auth.retry}>Check again</Button>}
    {auth.status !== 'checking' && (auth.status !== 'signed-out' || auth.signOutError) && <Button variant="outline" onClick={() => void auth.signOut()}>Sign out</Button>}
  </div></main>;
}
