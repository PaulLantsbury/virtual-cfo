import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useActiveStore } from '@/lib/auth/AuthProvider';
import { fetchXeroMerchantReadiness } from '@/lib/xeroMerchantApi';
import { accountCanMapTo, fetchXeroStagingDiscovery, startXeroStagingBootstrap, startXeroStagingDiscovery, validateXeroBootstrapSelection, XERO_MAPPING_CATEGORIES, type XeroBootstrapMapping, type XeroDiscovery, type XeroMappingCategory } from '@/lib/xeroStagingDiscovery';

const QUERY_KEY = 'xeroDiscovery';
const CONNECTED_KEY = 'xeroConnected';
const LABELS: Record<XeroMappingCategory,string> = {revenue:'Booked revenue',processingFee:'Processing fees',advertising:'Advertising',software:'Software',includedCash:'Included cash'};
const emptyMapping = (): Record<XeroMappingCategory,string[]> => ({revenue:[],processingFee:[],advertising:[],software:[],includedCash:[]});
const today = () => new Date().toISOString().slice(0,10);

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
  const storeId=useActiveStore(),queryClient=useQueryClient();
  const readiness=useQuery({queryKey:['xero-merchant-readiness',storeId],queryFn:({signal})=>fetchXeroMerchantReadiness(storeId,signal),retry:false,refetchOnWindowFocus:false});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<XeroDiscovery | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [mapping, setMapping] = useState<Record<XeroMappingCategory,string[]>>(emptyMapping);

  useEffect(() => {
    const url = new URL(window.location.href);
    const connected=url.searchParams.get(CONNECTED_KEY)==='1';
    const handle = url.searchParams.get(QUERY_KEY);
    if(connected)url.searchParams.delete(CONNECTED_KEY);
    if(handle)url.searchParams.delete(QUERY_KEY);
    if(connected||handle)window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    if(connected)void queryClient.invalidateQueries({queryKey:['xero-merchant-readiness',storeId]});
    if (!handle) return;
    const controller = new AbortController();
    setBusy(true);
    void currentAccessToken()
      .then(token => fetchXeroStagingDiscovery(handle, token, controller.signal))
      .then(result => { setDiscovery(result); setError(null); })
      .catch(() => { if (!controller.signal.aborted) setError('The Xero discovery result is unavailable or expired. Start discovery again.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [queryClient,storeId]);

  const start = async () => {
    setBusy(true); setError(null); setDiscovery(null); setEffectiveFrom(today()); setMapping(emptyMapping());
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
  const selection=discovery?validateXeroBootstrapSelection(discovery,effectiveFrom,mapping as XeroBootstrapMapping):null;
  const missing=XERO_MAPPING_CATEGORIES.filter(category=>mapping[category].length===0);
  const connect = async () => {
    if (!discovery) return;
    if(!selection){setError('Choose at least one compatible active account for every category, use each account once, and enter a valid effective date.');return;}
    setBusy(true);setError(null);
    try { const token=await currentAccessToken();const result=await startXeroStagingBootstrap(selection,token);window.location.assign(result.url); }
    catch(cause){setError(cause instanceof Error?cause.message:'Xero connection unavailable');setBusy(false);}
  };

  if(readiness.isPending)return <section aria-label="Xero staging discovery" className="rounded-xl border bg-card p-4"><h3 className="font-medium">Checking Xero connection</h3><p className="mt-1 text-sm text-muted-foreground">Night Scout is checking the persisted connection for this store.</p></section>;
  if(readiness.data?.connection?.status==='active')return <section aria-label="Xero staging discovery" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"><h3 className="font-medium">Xero connected</h3><p className="mt-1 text-sm text-muted-foreground">The read-only Xero connection and owner-confirmed mapping are persisted for this store. Accounting evidence will remain unavailable until the first successful refresh.</p></section>;
  if(readiness.isError)return <section aria-label="Xero staging discovery" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><h3 className="font-medium">Xero connection status unavailable</h3><p className="mt-1 text-sm text-muted-foreground">Night Scout cannot safely start another connection until the persisted state can be checked.</p><button type="button" className="mt-3 text-sm font-medium text-primary underline underline-offset-4" onClick={()=>readiness.refetch()}>Check connection again</button></section>;

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
      {XERO_MAPPING_CATEGORIES.map(category=>{const eligible=discovery.accounts!.filter(account=>accountCanMapTo(account,category));const usedElsewhere=new Set(XERO_MAPPING_CATEGORIES.filter(value=>value!==category).flatMap(value=>mapping[value]));return <fieldset key={category} className="rounded-md border bg-background p-3"><legend className="px-1 text-sm font-medium">{LABELS[category]} <span className="font-normal text-muted-foreground">({mapping[category].length} selected)</span></legend><div className="mt-1 max-h-40 space-y-2 overflow-auto">{eligible.map(account=><label key={account.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={mapping[category].includes(account.id)} disabled={busy||usedElsewhere.has(account.id)||(!mapping[category].includes(account.id)&&mapping[category].length>=20)} onChange={()=>{setError(null);toggle(category,account.id);}}/><span><span className="font-medium">{account.code?`${account.code} — `:''}{account.name}</span><span className="ml-2 text-xs text-muted-foreground">{account.type}</span></span></label>)}{eligible.length===0&&<p className="text-sm text-amber-700 dark:text-amber-300">No compatible active account was returned by Xero.</p>}</div>{mapping[category].length===0&&<p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Select at least one account.</p>}</fieldset>;})}
      <label className="block text-sm font-medium">Mapping effective date<input type="date" required max={today()} value={effectiveFrom} disabled={busy} onChange={event=>{setError(null);setEffectiveFrom(event.target.value);}} className="mt-1 block rounded-md border bg-background px-3 py-2"/></label>
      <p className="text-sm text-muted-foreground">Connecting requests read-only accounting access and retains an encrypted refresh credential in staging. No credential is exposed in this page.</p>
      {!selection&&<p role="status" className="text-sm text-amber-700 dark:text-amber-300">Complete the mapping before connecting{missing.length?`: ${missing.map(category=>LABELS[category]).join(', ')} need a selection`:''}.</p>}
      {error&&<p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
      <button type="button" disabled={busy||!selection} onClick={connect} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{busy?'Connecting Xero…':'Save mapping and connect Xero'}</button>
    </div>}
  </section>;
}
