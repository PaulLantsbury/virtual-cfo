import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { useActiveStore, useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { HISTORY_EDITION,historyChoiceEnabled,historyChoiceWithdrawn,historyAvailableMonths,type HistorySelection } from '@/lib/v11/history-supported';
import { HistorySupportedPanel } from './history-supported-panel';

class HistoryRequestError extends Error { constructor(public denied:boolean){super(denied?'History access denied.':'History evidence could not be checked.');} }

/** Prepared opt-in host. No runtime service enablement, sample fallback or v1 preference changes. */
export default function HistoryLivePage(){
 const storeId=useActiveStore(),auth=useAuth();
 const [choice,setChoice]=useState<{userId:string|null;storeId:string;edition:string;from:string;to:string;versionId:string}>({userId:null,storeId:'',edition:'',from:'',to:'',versionId:''});
 const enabled=historyChoiceEnabled(choice,auth.userId,storeId);
 const request=async(path:string,query:Record<string,string>,signal:AbortSignal)=>{
  const {data,error}=await supabase.auth.getSession();if(error||!data.session||data.session.user.id!==auth.userId)throw new HistoryRequestError(true);
  const response=await fetch(`${path}?${new URLSearchParams(query)}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});
  if(!response.ok)throw new HistoryRequestError(response.status===401||response.status===403);return response.json();
 };
 const available=useQuery({queryKey:['history-months',auth.userId,storeId,choice.edition],enabled,retry:false,placeholderData:undefined,queryFn:({signal})=>request('/api/history-reporting/months',{storeId,currency:'GBP',edition:HISTORY_EDITION},signal)});
 const availability=enabled&&available.isSuccess&&!available.isFetching&&!available.isError?available.data:null;
 const anchor=availability?.anchor??'';
 const months=historyAvailableMonths(availability,{storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor});
 const month=enabled?months.find(m=>m.from===choice.from&&m.to===choice.to):undefined;
 const versions=month?.versions??(month?.versionId?[{versionId:month.versionId,status:'selected' as const,kind:'base' as const}]:[]);
 const selectedVersion=versions.find(v=>v.versionId===choice.versionId&&v.status==='selected');
 const result=useQuery({queryKey:['history-report',auth.userId,storeId,choice.edition,choice.from,choice.to,choice.versionId],enabled:enabled&&!!month&&!!selectedVersion,retry:false,placeholderData:undefined,queryFn:({signal})=>request('/api/history-reporting',{storeId,currency:'GBP',from:choice.from,to:choice.to,edition:HISTORY_EDITION,versionId:choice.versionId},signal)});
 const selection:HistorySelection={storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor,period:{from:enabled?choice.from:'',to:enabled?choice.to:''},versionId:enabled?choice.versionId:''};
 return <AppLayout showMonitoring={false}>
 <h1>Sales and profit history</h1><p>Choose the synthetic history and a reviewed reporting month. Existing reporting preferences stay unchanged.</p>
 <label>History<select value={enabled?HISTORY_EDITION:''} onChange={e=>setChoice({userId:auth.userId,storeId,edition:e.target.value,from:'',to:'',versionId:''})}><option value="">Choose history</option><option value={HISTORY_EDITION}>Synthetic company · complete history</option></select></label>
 {!availability&&<details><summary>Explore the Numbers</summary><p>Business: {storeId} · GBP · Europe/London. Choose a history, month and evidence version to inspect supported amounts. No source freshness or financial readiness is inferred from the list of choices.</p></details>}
 {enabled&&<><p>Choose a reviewed month and evidence version. Figures are checked against source records after selection.</p>

 {available.isFetching&&<p role="status">Loading reviewed reporting months…</p>}
 {available.isError&&<p role="alert">{available.error instanceof HistoryRequestError&&available.error.denied?'Access to this history is not authorised. Check your business membership.':'Checking reviewed months failed. Retry the check.'}</p>}
 {available.isError&&<button type="button" onClick={()=>void available.refetch()}>Retry month check</button>}
 {availability&&<HistorySupportedPanel invalidated={historyChoiceWithdrawn(choice.versionId,versions)} onRetry={()=>void result.refetch()} loading={result.isFetching} error={result.isError?(result.error instanceof HistoryRequestError&&result.error.denied?'denied':'unavailable'):undefined} versionControl={<label>Evidence version<select value={selectedVersion?.versionId??''} disabled={!month} onChange={e=>setChoice({...choice,versionId:e.target.value})}><option value="">Choose evidence version</option>{versions.map((v,index)=><option key={v.versionId} value={v.versionId} disabled={v.status!=='selected'}>{v.kind==='base'?'Original reviewed evidence':'Reviewed correction'}{v.status==='invalidated'?' · unavailable':''}{versions.length>1?` · ${index+1}`:''}</option>)}</select></label>} selection={selection} availability={availability} response={result.isSuccess&&selectedVersion?result.data:null} onMonthChange={range=>setChoice({...choice,...range,versionId:''})}/>}
 <details id="history-selection-context"><summary>Selected evidence context</summary><p>Edition: {HISTORY_EDITION} · version: {selection.versionId||'Not selected'} · opening basis: {anchor||'Unavailable'}.</p></details>
 </>}
 </AppLayout>;
}
