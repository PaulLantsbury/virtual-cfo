import {useQuery} from '@tanstack/react-query';
import {useAuth,useActiveStore} from '@/lib/auth/AuthProvider';
import {supabase} from '@/lib/supabase';
import {deploymentForStore} from '@/lib/connections/nightlyDeployment';
import {parseShopifyStatus,collectionWarning,type Attempt} from '@/lib/connections/shopifyStatus';
import {shopifyTestDataStatus} from '@/lib/connections/shopifyTestDataStatus';
const resultLabels: Record<string,string> = {recorded_requires_review:'Candidate received — review needed',changed_requires_review:'Changed candidate received — review needed',replay:'Unchanged collection — no new candidate',historical_replay:'Historical replay — not a new current collection',missing_source:'Source history is missing',stale_source:'Older source was refused',conflicting_source:'Source versions conflict'};
const timestamp=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC':'Not recorded';
function AttemptDetails({attempt}:{attempt:Attempt|null}){return !attempt?<p>No attempt has been recorded.</p>:<dl className="grid gap-3 sm:grid-cols-2"><div><dt>Outcome</dt><dd>{attempt.state==='running'?'Unfinished attempt — may have been interrupted':attempt.state==='unconfirmed'?'Outcome unconfirmed — needs investigation':resultLabels[attempt.resultCode??'']}</dd></div><div><dt>Reporting period</dt><dd>{attempt.from} to {attempt.to}</dd></div><div><dt>Started</dt><dd>{timestamp(attempt.startedAt)}</dd></div><div><dt>Finished</dt><dd>{timestamp(attempt.finishedAt)}</dd></div></dl>;}
export function ShopifyConnectionStatus(){
 const storeId=useActiveStore(),auth=useAuth();
 const query=useQuery({queryKey:['shopify-connection-status',auth.userId,storeId,auth.revision],enabled:auth.status==='ready'&&!!auth.userId,retry:false,refetchOnWindowFocus:false,placeholderData:undefined,
 queryFn:async({signal})=>{const {data,error}=await supabase.rpc('shopify_connection_status',{p_store_id:storeId}).abortSignal(signal);if(error)throw Error('Shopify connection status is unavailable');return parseShopifyStatus(data,storeId);}});
 const data=query.isSuccess&&query.data.storeId===storeId?query.data:null;
 const warning=data?collectionWarning(data):null;
 const testData=data?shopifyTestDataStatus(data):null;
 const deployment=deploymentForStore(import.meta.env.VITE_SUPABASE_URL,storeId);
 const names={not_assessed:'Candidate state has not been assessed',unavailable:'No current candidate for this attempt’s reporting period',current_unverified:'Current candidate — not financially verified',needs_recheck:'Candidate needs rechecking'};
 return <section aria-label="Shopify connection status" className="rounded-2xl border bg-card p-6 sm:p-8 space-y-6">
 <div><h2 className="text-xl font-semibold">Shopify connection status</h2><p className="mt-2 text-muted-foreground">Store: {auth.stores.find(s=>s.id===storeId)?.name??'Selected store'}</p><p className="mt-2 text-sm text-muted-foreground">Read-only connection records for your selected store. A completed collection does not mean its sales or profit figures have been verified.</p></div>
 <section aria-label="Nightly refresh plan" className="rounded-xl border p-4 space-y-2">
 <h3 className="font-semibold">Nightly refresh records</h3>
 <p className="text-sm">Use the latest saved collection records below to inspect received data. Scheduler configuration and a successful scheduled run need separate operational verification.</p>
 <details><summary className="cursor-pointer text-sm">Historical deployment record</summary><div className="mt-3 space-y-2">
 {deployment?<>
 <p className="text-sm font-medium">Historical observation: {deployment.firstRunObservation.scheduledLocalDate} failed before collection</p>
 <p className="text-sm">Deployment recorded on {deployment.acknowledgedOn}. Intended refresh: once daily at {deployment.intendedLocalTime} ({deployment.timezone}), with a {deployment.startupWindow} local start window.</p>
 <p className="text-sm">Checked on {deployment.firstRunObservation.checkedOn}: the {deployment.firstRunObservation.scheduledLocalDate} run scheduled for {deployment.firstRunObservation.scheduledLocalTime} ({deployment.timezone}) failed before collection started. No nightly collection was recorded for this run. The last successful collection below may be manual.</p>
 <p className="text-sm">At that checkpoint: {deployment.scheduleVerification==='confirmed'?'scheduler timing had been checked, but a successful overnight collection had not been verified.':'the scheduler’s timezone still needed verification.'}</p>
 <p className="text-sm">Original trial reporting period: {deployment.reportFrom} to {deployment.reportTo}. This historical record does not describe the current reporting window.</p>
 <p className="text-sm text-muted-foreground">This is a dated deployment and run observation, not a live scheduler check. It does not establish the outcome of later runs. Collection records below include manual and automatic attempts; they cannot confirm the overnight schedule by themselves.</p>
 </>:<p className="text-sm">Planned: once daily at 2am in the store’s local timezone. No deployment acknowledgement is available for this store and environment; automatic collection is not assumed.</p>}
 </div></details>
 <p className="text-sm text-muted-foreground">Refreshing this screen only reads saved collection status. It does not collect Shopify data or check the cloud scheduler. Collection success does not verify sales or profit figures.</p>
 </section>
 {warning&&<p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">{warning}</p>}
 <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={query.isFetching} onClick={()=>void query.refetch()}>Refresh connection status</button>
 {query.isPending?<p role="status">Checking connection records…</p>:!data?<p role="status">Connection status unavailable. The records may not be set up yet, or could not be read. No connection or successful collection is assumed.</p>:data.state==='not_configured'?<p role="status">No Shopify connection records are configured for this store. This does not check the store’s Shopify account.</p>:<>
 <section aria-label="Latest recorded collection attempt" className="space-y-3"><h3 className="font-semibold">Latest recorded collection attempt</h3><AttemptDetails attempt={data.latestAttempt}/><p className="text-sm text-muted-foreground">An unfinished record does not prove a process is still running.</p></section>
 <section aria-label="Last successful collection"><h3 className="font-semibold mb-2">Last successful collection</h3><p>{data.latestSuccessfulCollection?timestamp(data.latestSuccessfulCollection.finishedAt):'No successful collection is recorded.'}</p>{data.latestSuccessfulCollection&&<><p>{data.latestSuccessfulCollection.from} to {data.latestSuccessfulCollection.to}</p><p>{resultLabels[data.latestSuccessfulCollection.resultCode]}</p></>}<p className="text-sm text-muted-foreground">Collection records persist between sessions. They do not certify source completeness or financial accuracy.</p></section>
 {testData&&<section aria-label="Recorded Shopify test data" className="rounded-xl border p-4 space-y-2"><h3 className="font-semibold">Recorded Shopify test data</h3><p role="status">{testData.title}</p>{data.candidate.from&&<p className="text-sm">Candidate reporting period: {data.candidate.from} to {data.candidate.to}</p>}<p className="text-sm text-muted-foreground">{testData.detail}</p><p className="text-sm text-muted-foreground">Test orders check the data connection. They do not populate merchant revenue or the sample Profit Engine and Cash Control demonstrations. This screen cannot create orders or activate a writer.</p></section>}
 <section aria-label="Candidate review status" className="space-y-3"><h3 className="font-semibold">Candidate review status</h3><p role="status">{names[data.candidate.state]}</p>{data.candidate.from&&<p>{data.candidate.from} to {data.candidate.to}</p>}<dl className="grid gap-3 sm:grid-cols-2">{[['Source orders',data.candidate.orderCount],['Source refunds',data.candidate.refundCount],['Mapped financial events',data.candidate.mappedEventCount],['Excluded test orders',data.candidate.testExcludedCount]].map(([label,value])=><div key={String(label)} role="group" aria-label={String(label)}><dt>{label}</dt><dd>{value??'Not assessed'}</dd></div>)}</dl><p className="text-sm">Financial verification: not assessed by this connection screen. Test orders remain excluded from sales.</p></section>
 </>}
 </section>;
}
