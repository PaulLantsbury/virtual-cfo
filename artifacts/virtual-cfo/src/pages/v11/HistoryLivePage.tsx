import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { useActiveStore, useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { HISTORY_EDITION,historyAvailableMonths,type HistorySelection } from '@/lib/v11/history-supported';
import { HistorySupportedPanel } from './history-supported-panel';

/** Prepared opt-in host. No runtime service enablement, sample fallback or v1 preference changes. */
export default function HistoryLivePage(){
 const storeId=useActiveStore(),auth=useAuth();
 const [choice,setChoice]=useState<{storeId:string;edition:string;from:string;to:string;versionId:string}>({storeId:'',edition:'',from:'',to:'',versionId:''});
 const enabled=choice.storeId===storeId&&choice.edition===HISTORY_EDITION;
 const request=async(path:string,query:Record<string,string>,signal:AbortSignal)=>{
  const {data,error}=await supabase.auth.getSession();if(error||!data.session||data.session.user.id!==auth.userId)throw Error('Sign in again to inspect history.');
  const response=await fetch(`${path}?${new URLSearchParams(query)}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});
  if(!response.ok)throw Error('History evidence could not be checked.');return response.json();
 };
 const available=useQuery({queryKey:['history-months',auth.userId,storeId,choice.edition],enabled,retry:false,placeholderData:undefined,queryFn:({signal})=>request('/api/history-reporting/months',{storeId,currency:'GBP',edition:HISTORY_EDITION},signal)});
 const availability=available.isSuccess?available.data:null;
 const anchor=availability?.anchor??'';
 const months=historyAvailableMonths(availability,{storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor});
 const month=enabled?months.find(m=>m.from===choice.from&&m.to===choice.to):undefined;
 const versions=month?.versions??(month?.versionId?[{versionId:month.versionId,status:'selected' as const,kind:'base' as const}]:[]);
 const selectedVersion=versions.find(v=>v.versionId===choice.versionId&&v.status==='selected');
 const result=useQuery({queryKey:['history-report',auth.userId,storeId,choice.edition,choice.from,choice.to,choice.versionId],enabled:enabled&&!!month&&!!selectedVersion,retry:false,placeholderData:undefined,queryFn:({signal})=>request('/api/history-reporting',{storeId,currency:'GBP',from:choice.from,to:choice.to,edition:HISTORY_EDITION,versionId:choice.versionId},signal)});
 const selection:HistorySelection={storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor,period:{from:month?.from??'',to:month?.to??''},versionId:selectedVersion?.versionId??''};
 return <AppLayout showMonitoring={false}>
 <h1>Sales and profit history</h1><p>Choose the synthetic history and a reviewed reporting month. Existing reporting preferences stay unchanged.</p>
 <label>History<select value={enabled?HISTORY_EDITION:''} onChange={e=>setChoice({storeId,edition:e.target.value,from:'',to:'',versionId:''})}><option value="">Choose history</option><option value={HISTORY_EDITION}>Synthetic company · complete history</option></select></label>
 {enabled&&<><p>Choose a reviewed month and evidence version. Figures are checked against source records after selection.</p>

 {(available.isFetching||result.isFetching)&&<p role="status">Checking history evidence…</p>}
 {(available.isError||result.isError)&&<p role="alert">History evidence is unavailable. Check source access and try again later.</p>}
 <HistorySupportedPanel versionControl={<label>Evidence version<select value={selectedVersion?.versionId??''} disabled={!month} onChange={e=>setChoice({...choice,versionId:e.target.value})}><option value="">Choose evidence version</option>{versions.map((v,index)=><option key={v.versionId} value={v.versionId} disabled={v.status!=='selected'}>{v.kind==='base'?'Original reviewed evidence':'Reviewed correction'}{v.status==='invalidated'?' · unavailable':''}{versions.length>1?` · ${index+1}`:''}</option>)}</select></label>} selection={selection} availability={availability} response={result.isSuccess&&selectedVersion?result.data:null} onMonthChange={range=>setChoice({...choice,...range,versionId:''})}/>
 <details id="history-selection-context"><summary>Selected evidence context</summary><p>Edition: {HISTORY_EDITION} · version: {selectedVersion?.versionId??'Not selected'} · opening basis: {anchor||'Unavailable'}.</p></details>
 </>}
 </AppLayout>;
}
