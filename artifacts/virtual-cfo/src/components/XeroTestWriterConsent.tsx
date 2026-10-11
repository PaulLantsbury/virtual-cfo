import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { startXeroTestWriterConsent, writerConsentVisible } from '@/lib/xeroTestWriterConsent';

/** Operator-only staging consent; the server independently enforces owner and store membership. */
export function XeroTestWriterConsent() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (auth.status !== 'ready' || !writerConsentVisible({ enabled: import.meta.env.VITE_XERO_TEST_WRITER_CONSENT_ENABLED,
    ownerId: import.meta.env.VITE_XERO_TEST_WRITER_OWNER_ID, configuredStoreId: import.meta.env.VITE_XERO_TEST_WRITER_STORE_ID,
    userId: auth.userId, storeId: auth.storeId, origin: window.location.origin })) return null;
  const connect = async () => {
    setBusy(true); setError(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const session = data.session;
      if (sessionError || session?.user.id !== auth.userId || !session?.access_token || !session.expires_at || session.expires_at * 1000 <= Date.now()) throw Error('Sign in again before connecting the Xero test writer.');
      window.location.assign(await startXeroTestWriterConsent(session.access_token));
    } catch {
      setError('The Xero test writer is not ready. Check its separate staging credentials and sign-in before trying again.');
      setBusy(false);
    }
  };
  return <section aria-label="Xero demo test writer" className="rounded-xl border bg-card p-4">
    <h3 className="font-medium">Connect Xero demo test writer</h3>
    <p className="mt-2 text-sm text-muted-foreground">Choose the GBP Xero Demo Company for the separate test programme. An ordinary trial organisation is not eligible. This consent saves the test connection; invoice generation stays disabled.</p>
    <p className="mt-2 text-sm text-muted-foreground">Demo invoices appear in accounting reports only when a read feed is connected to that same demo organisation.</p>
    <button type="button" disabled={busy} onClick={connect} className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? 'Opening Xero consent…' : 'Connect demo test writer'}</button>
    {error && <p role="alert" className="mt-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>}
  </section>;
}
