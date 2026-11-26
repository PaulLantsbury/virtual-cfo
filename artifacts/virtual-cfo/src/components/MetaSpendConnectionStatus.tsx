import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth,useActiveStore} from '@/lib/auth/AuthProvider';
import {cancelMetaAdSelection,disconnectMetaAds,fetchMetaAdSelection,fetchMetaAdsStatus,selectMetaAdAccount,startMetaAdsConnect,type MetaAdAccount,type MetaConnection} from '@/lib/metaAdsApi';

const timestamp=(value:string|null)=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC':'Not recorded';
const stateLabel:Record<MetaConnection['status'],string>={pending:'Connection pending',connected:'Connected',reauthorization_required:'Reconnect required',disconnected:'Disconnected',revoked:'Access revoked'};
const spendFailure:Record<string,string>={token_expired:'Meta access expired; reconnect the account.',access_revoked:'Meta access was revoked; reconnect the account.',provider_unavailable:'Meta could not be reached during the last collection.',invalid_response:'The last Meta response could not be accepted.',scope_missing:'The required ads_read permission is missing.'};

export function MetaSpendConnectionStatus(){
 const storeId=useActiveStore(),auth=useAuth(),queryClient=useQueryClient();
 const [selection,setSelection]=useState<{accounts:readonly MetaAdAccount[];expiresAt:string}|null>(null);
 const [selectedAccount,setSelectedAccount]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const query=useQuery({queryKey:['meta-ads-status',auth.userId,storeId,auth.revision],enabled:auth.status==='ready'&&!!auth.userId,retry:false,refetchOnWindowFocus:false,queryFn:({signal})=>fetchMetaAdsStatus(storeId,signal)});
 const refresh=()=>queryClient.invalidateQueries({queryKey:['meta-ads-status',auth.userId,storeId,auth.revision]});

 useEffect(()=>{
  const url=new URL(window.location.href),marker=url.searchParams.get('metaSelection'),cancelled=url.searchParams.get('metaConnect')==='cancelled';
  if(!marker&&!cancelled)return;
  url.searchParams.delete('metaSelection');url.searchParams.delete('metaConnect');
  window.history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);
  if(cancelled){setMessage('Meta connection was cancelled. No account was connected.');return;}
  if(marker!=='select')return;
  const controller=new AbortController();setBusy(true);setMessage('Checking the Meta accounts available to this connection…');
  void fetchMetaAdSelection(storeId,controller.signal).then(result=>{
   setSelection({accounts:result.accounts,expiresAt:result.expiresAt});setSelectedAccount(result.accounts[0]?.accountId??'');setMessage('Choose the Meta ad account whose spend Night Scout should read.');
  }).catch(()=>{if(!controller.signal.aborted)setMessage('The Meta account selection could not be loaded. It may have expired; start the connection again.');}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[storeId,auth.revision]);

 const active=query.data?.connections.filter(c=>c.status==='connected').at(0)??null;
 const connect=async()=>{setBusy(true);setMessage('Opening Meta authorization…');try{const url=await startMetaAdsConnect(storeId);window.location.assign(url);}catch{setBusy(false);setMessage('Meta connection is not available in this environment yet. No account was connected.');}};
 const choose=async()=>{if(!selection||!selectedAccount)return;setBusy(true);setMessage('Saving the selected Meta ad account…');try{await selectMetaAdAccount(storeId,selectedAccount);setSelection(null);setSelectedAccount('');setMessage('Meta ad account connected. Spend collection and reporting availability are shown separately below.');await refresh();}catch{setMessage('The account selection could not be saved. The selection may have expired; reconnect Meta and try again.');}finally{setBusy(false);}};
 const cancelSelection=async()=>{setBusy(true);try{await cancelMetaAdSelection(storeId);setMessage('Account selection cancelled. No account was connected.');}catch{setMessage('Account selection closed. Its protected selection will expire automatically.');}finally{setSelection(null);setSelectedAccount('');setBusy(false);}};
 const disconnect=async(connection:MetaConnection)=>{if(!window.confirm('Disconnect Meta Ads from this store? Existing spend history will be retained.'))return;setBusy(true);setMessage('Disconnecting Meta Ads…');try{await disconnectMetaAds(storeId,connection.connectionId);setMessage('Meta Ads disconnected. Existing spend history is retained.');await refresh();}catch{setMessage('Meta Ads could not be disconnected. Check the connection status and try again.');}finally{setBusy(false);}};

 return <section aria-label="Meta ad spend connection" className="rounded-2xl border bg-card p-6 sm:p-8 space-y-5">
  <div><h2 className="text-xl font-semibold">Meta ad spend</h2><p className="mt-2 text-muted-foreground">Connect a Meta ad account so Night Scout can collect ad spend only. This does not import campaign, audience, conversion or creative performance data.</p></div>
  {message&&<p role="status" className="rounded-xl border p-3 text-sm">{message}</p>}
  {selection&&<section aria-label="Choose a Meta ad account" className="rounded-xl border p-4 space-y-3">
   <h3 className="font-semibold">Choose an ad account</h3><label className="block text-sm" htmlFor="meta-ad-account">Meta ad account</label>
   <select id="meta-ad-account" className="w-full rounded-lg border bg-background p-2" value={selectedAccount} onChange={event=>setSelectedAccount(event.target.value)} disabled={busy}>
    {selection.accounts.map(account=><option key={account.accountId} value={account.accountId}>{account.accountId} · {account.currency} · {account.timeZone}</option>)}
   </select><p className="text-sm text-muted-foreground">Selection expires {timestamp(selection.expiresAt)}. Only the account chosen here will be connected.</p>
   <button type="button" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy||!selectedAccount} onClick={()=>void choose()}>Connect selected account</button>
   <button type="button" className="ml-3 rounded-lg border px-4 py-2 disabled:opacity-50" disabled={busy} onClick={()=>void cancelSelection()}>Cancel</button>
  </section>}
  {query.isPending?<p role="status">Checking the Meta connection…</p>:query.isError?<div className="space-y-3"><p role="status" className="text-sm text-muted-foreground">Meta Ads connection is not available in this environment yet. The server side must be configured before an account can be connected.</p><button type="button" className="rounded-lg border px-4 py-2" onClick={()=>void query.refetch()}>Check connection availability</button></div>:<>
   {active?<div className="rounded-xl border p-4 space-y-2">
    <h3 className="font-semibold">{stateLabel[active.status]}</h3><p>Ad account: {active.accountId} · {active.currency} · {active.timeZone}</p><p className="text-sm text-muted-foreground">Connected {timestamp(active.connectedAt)}. Meta access token expiry: {timestamp(active.tokenExpiresAt)}.</p>
    {active.latestRun?<div className="rounded-lg bg-muted/40 p-3"><p className="font-medium">Latest spend collection: {active.latestRun.status}</p><p className="text-sm">Period {active.latestRun.from} to {active.latestRun.to} · started {timestamp(active.latestRun.startedAt)}{active.latestRun.finishedAt?` · finished ${timestamp(active.latestRun.finishedAt)}`:''}</p>{active.latestRun.safeFailure&&<p className="mt-1 text-sm">{spendFailure[active.latestRun.safeFailure]}</p>}<p className="mt-1 text-sm text-muted-foreground">Collection status does not show or verify spend totals.</p></div>:<p className="text-sm text-muted-foreground">No spend collection run is recorded yet.</p>}
    <div className="flex flex-wrap gap-3"><button type="button" className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={busy} onClick={()=>void connect()}>Reconnect Meta</button><button type="button" className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={busy} onClick={()=>void disconnect(active)}>Disconnect</button></div>
   </div>:<div className="space-y-3"><p role="status" className="text-sm text-muted-foreground">{query.data?.connections.some(c=>c.status==='reauthorization_required'||c.status==='revoked')?'Meta needs to be reconnected before spend can be collected.':'No Meta ad account is connected for this store.'}</p><button type="button" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy} onClick={()=>void connect()}>Connect Meta ad account</button></div>}
   {query.data?.connections.some(c=>c.status==='reauthorization_required'||c.status==='revoked')&&!active&&<p className="text-xs text-muted-foreground">Prior connection: {query.data.connections.filter(c=>c.status==='reauthorization_required'||c.status==='revoked').map(c=>stateLabel[c.status]).join(', ')}.</p>}
   <button type="button" className="text-sm font-medium text-primary underline underline-offset-4 disabled:opacity-50" disabled={query.isFetching} onClick={()=>void query.refetch()}>Refresh Meta connection status</button>
  </>}
  <p className="text-xs text-muted-foreground">Spend totals will appear in Night Scout reporting only after the daily collector and reporting read path are enabled. Meta attribution and billing timing can differ; the figures represent platform-reported spend for the selected account.</p>
 </section>;
}
