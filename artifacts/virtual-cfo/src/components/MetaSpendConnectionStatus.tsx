import {useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useAuth} from '@/lib/auth/AuthProvider';
import {createMetaConnectionJourney,metaConnectionScopeKey} from '@/lib/metaConnectionJourney';
import type {MetaConnection} from '@/lib/metaAdsApi';

const timestamp=(value:string|null)=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC':'Not recorded';
const stateLabel:Record<MetaConnection['status'],string>={pending:'Connection pending',connected:'Connected',reauthorization_required:'Reconnect required',disconnected:'Disconnected',revoked:'Access revoked'};
const button='rounded-lg border px-4 py-2 disabled:opacity-50';
/** Default-off Settings surface. All network actions require a click; callback URL is only a hint. */
export function MetaSpendConnectionStatus(){
 const auth=useAuth(),scope={userId:auth.userId??'',storeId:auth.storeId??'',revision:auth.revision,ready:auth.status==='ready'};
 const currentScope=useRef(scope);currentScope.current=scope;
 const journey=useMemo(()=>createMetaConnectionJourney(()=>currentScope.current),[]),state=useSyncExternalStore(journey.subscribe,journey.getSnapshot,journey.getSnapshot);
 const key=metaConnectionScopeKey(scope),[chosen,setChosen]=useState(''),[confirm,setConfirm]=useState('');
 const [callback,setCallback]=useState(''),callbackReceipt=useRef<{key:string;message:string}|null>(null);
 useLayoutEffect(()=>{journey.clear();setChosen('');setConfirm('');setCallback('');return()=>journey.clear();},[journey,key]);
 useLayoutEffect(()=>{
  if(!scope.ready)return;
  if(callbackReceipt.current){if(callbackReceipt.current.key===key)setCallback(callbackReceipt.current.message);return;}
  const url=new URL(window.location.href);const selection=url.searchParams.getAll('metaSelection'),cancelled=url.searchParams.getAll('metaConnect');
  if(!selection.length&&!cancelled.length)return;
  url.searchParams.delete('metaSelection');url.searchParams.delete('metaConnect');window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  const message=selection.length===1&&selection[0]==='select'&&!cancelled.length?'Meta returned an account-selection step. Check pending selection for this signed-in company; the return link alone does not establish a connection.':cancelled.length===1&&cancelled[0]==='cancelled'&&!selection.length?'Meta authorization was cancelled. Check connection status if you need to confirm an earlier connection.':'The Meta return link could not be interpreted. Check connection status.';
  callbackReceipt.current={key,message};setCallback(message);
 },[key,scope.ready]);
 const visible=scope.ready&&state.scopeKey===key?state:null,busy=visible?.busy??false;
 const connections=visible?.connections??null,selection=visible?.selection??null;
 const run=(action:Parameters<typeof journey.run>[0],id='')=>{setConfirm('');setChosen('');void journey.run(action,id);};
 return <section aria-label="Meta ad spend connection" className="rounded-2xl border bg-card p-5 sm:p-6 space-y-4" style={{minWidth:0,overflowWrap:'anywhere'}}>
  <h2 className="text-xl font-semibold">Meta ad spend connection</h2>
  <p>Manage the Meta account for this company. Connecting grants read-only ad-spend access; it does not change advertising, start collection or prove that saved spend is complete.</p>
  {!scope.ready?<p role="status">Sign in and choose a company to manage its Meta connection.</p>:<>
   {callback&&<p role="status">{callback}</p>}
   {visible?.message&&<p role="status">{visible.message}</p>}
   <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={()=>run('status')}>Check Meta connection status</button><button className={button} disabled={busy} onClick={()=>run('selection')}>Check pending Meta selection</button></div>
   {connections!==null&&<>
    {!connections.length&&<p>No Meta connection record was returned for this company.</p>}
    {connections.map(connection=><article key={connection.connectionId} className="rounded-xl border p-4 space-y-2">
     <h3 className="font-semibold">{connection.status==='connected'&&connection.tokenExpiresAt&&Date.parse(connection.tokenExpiresAt)<=Date.now()?'Reconnect required · recorded access has expired':stateLabel[connection.status]}</h3>
     <p>Account: {connection.accountId??'Not selected'} · {connection.currency??'Currency unavailable'} · {connection.timeZone??'Timezone unavailable'}</p>
     <p>Connected: {timestamp(connection.connectedAt)}. Access expiry: {timestamp(connection.tokenExpiresAt)}.</p>
     <p>{connection.latestRun?`Last recorded collection: ${connection.latestRun.status} · ${connection.latestRun.from} to ${connection.latestRun.to}.`:'No collection run is recorded.'} Connection and collection status do not certify spend totals or freshness.</p>
     {connection.status!=='disconnected'&&(confirm===connection.connectionId?<div className="space-y-2"><p>Disconnect this account from this company? Saved records may be retained but will not remain eligible simply because they exist.</p><div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={()=>run('disconnect',connection.connectionId)}>Confirm Meta disconnect</button><button className={button} onClick={()=>setConfirm('')}>Keep connection</button></div></div>:<button className={button} disabled={busy} onClick={()=>setConfirm(connection.connectionId)}>Disconnect this Meta connection</button>)}
    </article>)}
    <button className={button} disabled={busy} onClick={()=>run('connect')}>{connections.length?'Connect or reconnect Meta':'Connect Meta ad account'}</button>
    <p className="text-sm text-muted-foreground">This opens Meta authorization. You will choose an account after returning; no account is chosen automatically.</p>
   </>}
   {selection&&<div className="rounded-xl border p-4 space-y-3"><h3 className="font-semibold">Choose a Meta ad account</h3><label className="block" htmlFor="meta-connection-account">Account, currency and timezone</label><select id="meta-connection-account" className="w-full max-w-full rounded-lg border bg-background p-2" value={chosen} onChange={e=>setChosen(e.target.value)} disabled={busy}><option value="">Choose an account</option>{selection.accounts.map(account=><option key={account.accountId} value={account.accountId}>{account.accountId} · {account.currency} · {account.timeZone}</option>)}</select><p>Pending selection expires {timestamp(selection.expiresAt)}.</p><div className="flex flex-wrap gap-3"><button className={button} disabled={busy||!chosen} onClick={()=>run('choose',chosen)}>Connect selected Meta account</button><button className={button} disabled={busy} onClick={()=>run('cancel')}>Cancel pending Meta selection</button></div></div>}
  </>}
  <p className="text-sm text-muted-foreground">Saved spend is read separately in Growth &amp; Marketing when that reporting feature is available. This connection does not supply customer attribution, CAC, ROAS or financial advertising totals.</p>
 </section>;
}
