import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { accountCanMapTo, fetchXeroStagingDiscovery, startXeroStagingBootstrap, startXeroStagingDiscovery, validateXeroBootstrapSelection, XERO_MAPPING_CATEGORIES, type XeroBootstrapMapping, type XeroDiscovery, type XeroMappingCategory } from '@/lib/xeroStagingDiscovery';

const QUERY_KEY = 'xeroDiscovery';
const LABELS: Record<XeroMappingCategory,string> = {revenue:'Booked revenue',processingFee:'Processing fees',advertising:'Advertising',software:'Software',includedCash:'Included cash'};
const emptyMapping = (): Record<XeroMappingCategory,string[]> => ({revenue:[],processingFee:[],advertising:[],software:[],includedCash:[]});

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
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [mapping, setMapping] = useState<Record<XeroMappingCategory,string[]>>(emptyMapping);

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
    setBusy(true); setError(null); setDiscovery(null); setEffectiveFrom(''); setMapping(emptyMapping());
    try {
      const token = await currentAccessToken();
      const result = await startXeroStagingDiscovery(token);
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Xero discovery unavailable');
      setBusy(false);
    }
  };

  const toggle = (category:XeroMappingCategory, id:string) => setMapping(current => {
    const selected=current[category],next=selected.includes(id)?selected.filter(value=>value!==id):[...selected,id];
    return {...current,[category]:next};
  });
  const connect = async () => {
    if (!discovery) return;
    const selection=validateXeroBootstrapSelection(discovery,effectiveFrom,mapping as XeroBootstrapMapping);
    if(!selection){setError('Choose at least one compatible active account for every category, use each account once, and enter a valid effective date.');return;}
    setBusy(true);setError(null);
    try { const token=await currentAccessToken();const result=await startXeroStagingBootstrap(selection,token);window.location.assign(result.url); }
    catch(cause){setError(cause instanceof Error?cause.message:'Xero connection unavailable');setBusy(false);}
  };

  return <section aria-label="Xero staging discovery" className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
    <h3 className="font-medium">Discover Xero test organisation</h3>
    <p className="mt-1 text-sm text-muted-foreground">Staging owner tool. Xero consent returns only an opaque, short-lived handle; Night Scout then shows bounded organisation and account-directory metadata for mapping review. It does not display or retain credentials here.</p>
    <button type="button" disabled={busy} onClick={start} className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
      {busy ? 'Checking Xero…' : 'Discover Xero test account'}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>}
    {discovery?.status === 'pending' && <p role="status" className="mt-3 text-sm">Xero discovery is still being prepared. Start discovery again if this does not update.</p>}
    {discovery?.status === 'ready' && discovery.tenant && discovery.accounts && <div className="mt-4 space-y-4">
      <div><p className="text-sm font-medium">{discovery.tenant.name}</p><p className="font-mono text-xs text-muted-foreground">Tenant {discovery.tenant.id}</p></div>
      <p className="text-sm text-muted-foreground">Confirm the active accounts Night Scout may use. Suggestions are not applied automatically, and an account can appear in only one category.</p>
      {XERO_MAPPING_CATEGORIES.map(category=>{const eligible=discovery.accounts!.filter(account=>accountCanMapTo(account,category));const usedElsewhere=new Set(XERO_MAPPING_CATEGORIES.filter(value=>value!==category).flatMap(value=>mapping[value]));return <fieldset key={category} className="rounded-md border bg-background p-3"><legend className="px-1 text-sm font-medium">{LABELS[category]}</legend><div className="mt-1 max-h-40 space-y-2 overflow-auto">{eligible.map(account=><label key={account.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={mapping[category].includes(account.id)} disabled={busy||usedElsewhere.has(account.id)||(!mapping[category].includes(account.id)&&mapping[category].length>=20)} onChange={()=>toggle(category,account.id)}/><span><span className="font-medium">{account.code?`${account.code} — `:''}{account.name}</span><span className="ml-2 text-xs text-muted-foreground">{account.type}</span></span></label>)}{eligible.length===0&&<p className="text-sm text-amber-700 dark:text-amber-300">No compatible active account was returned by Xero.</p>}</div></fieldset>;})}
      <label className="block text-sm font-medium">Mapping effective date<input type="date" required value={effectiveFrom} disabled={busy} onChange={event=>setEffectiveFrom(event.target.value)} className="mt-1 block rounded-md border bg-background px-3 py-2"/></label>
      <p className="text-sm text-muted-foreground">Connecting requests read-only accounting access and retains an encrypted refresh credential in staging. No credential is exposed in this page.</p>
      <button type="button" disabled={busy} onClick={connect} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{busy?'Connecting Xero…':'Save mapping and connect Xero'}</button>
    </div>}
  </section>;
}
