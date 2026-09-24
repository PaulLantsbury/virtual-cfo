import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchXeroStagingDiscovery, startXeroStagingDiscovery, type XeroDiscovery } from '@/lib/xeroStagingDiscovery';

const QUERY_KEY = 'xeroDiscovery';

async function currentAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  if (error || !session?.access_token || !session.expires_at || session.expires_at * 1000 <= Date.now()) {
    throw Error('Your sign-in has expired. Sign in again before connecting Xero.');
  }
  return session.access_token;
}

/** Staging-only owner workflow. It displays directory metadata, never tokens or financial amounts. */
export function XeroStagingDiscovery() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<XeroDiscovery | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const handle = url.searchParams.get(QUERY_KEY);
    if (!handle) return;
    url.searchParams.delete(QUERY_KEY);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    const controller = new AbortController();
    setBusy(true);
    void currentAccessToken()
      .then(token => fetchXeroStagingDiscovery(handle, token, controller.signal))
      .then(result => { setDiscovery(result); setError(null); })
      .catch(() => { if (!controller.signal.aborted) setError('The Xero discovery result is unavailable or expired. Start discovery again.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, []);

  const start = async () => {
    setBusy(true); setError(null); setDiscovery(null);
    try {
      const token = await currentAccessToken();
      const result = await startXeroStagingDiscovery(token);
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Xero discovery unavailable');
      setBusy(false);
    }
  };

  return <section aria-label="Xero staging discovery" className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
    <h3 className="font-medium">Discover Xero test organisation</h3>
    <p className="mt-1 text-sm text-muted-foreground">Staging owner tool. Xero consent returns only an opaque, short-lived handle; Night Scout then shows bounded organisation and account-directory metadata for mapping review. It does not display or retain credentials here.</p>
    <button type="button" disabled={busy} onClick={start} className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
      {busy ? 'Checking Xero…' : 'Discover Xero test account'}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>}
    {discovery?.status === 'pending' && <p role="status" className="mt-3 text-sm">Xero discovery is still being prepared. Start discovery again if this does not update.</p>}
    {discovery?.status === 'ready' && discovery.tenant && <div className="mt-4 space-y-3">
      <div><p className="text-sm font-medium">{discovery.tenant.name}</p><p className="font-mono text-xs text-muted-foreground">Tenant {discovery.tenant.id}</p></div>
      <div className="max-h-72 overflow-auto rounded-md border bg-background">
        <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>{discovery.accounts?.map(account => <tr key={account.id} className="border-t"><td className="px-3 py-2 font-mono">{account.code ?? '—'}</td><td className="px-3 py-2">{account.name}</td><td className="px-3 py-2">{account.type}</td><td className="px-3 py-2">{account.status}</td></tr>)}</tbody>
        </table>
      </div>
    </div>}
  </section>;
}
