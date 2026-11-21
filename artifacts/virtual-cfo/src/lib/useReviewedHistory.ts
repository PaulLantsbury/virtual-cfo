import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveStore, useAuth } from './auth/AuthProvider';
import { supabase } from './supabase';
import { HISTORY_EDITION, historyAvailableMonths, historyReadState, type HistorySelection } from './v11/history-supported';
import { composeHistoryMonth } from './v11/history-composition';

/** Read-only, explicit month/version selection shared by the New reporting pages. */
export function useReviewedHistory() {
 const storeId=useActiveStore(), {userId}=useAuth();
 const [choice,setChoice]=useState({userId:null as string|null,storeId:'',from:'',to:'',versionId:''});
 const current=choice.userId===userId&&choice.storeId===storeId;
 const request=async(path:string,query:Record<string,string>,signal:AbortSignal)=>{
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session||data.session.user.id!==userId)throw Error('Access to this business could not be verified.');
  const response=await fetch(`${path}?${new URLSearchParams(query)}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});
  if(!response.ok)throw Error(response.status===401||response.status===403?'Access to this business is not authorised.':'The selected evidence could not be checked.');
  return response.json();
 };
 const available=useQuery({queryKey:['new-reviewed-months',userId,storeId,HISTORY_EDITION],enabled:!!userId&&!!storeId,retry:false,placeholderData:undefined,queryFn:({signal})=>request('/api/history-reporting/months',{storeId,currency:'GBP',edition:HISTORY_EDITION},signal)});
 const availability=available.isSuccess&&!available.isFetching&&!available.isError?available.data:null;
 const anchor=typeof availability?.anchor==='string'?availability.anchor:'';
 const months=historyAvailableMonths(availability,{storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor});
 const chosen=current?months.find(m=>m.from===choice.from&&m.to===choice.to):undefined;
 const versions=chosen?.versions??(chosen?.versionId?[{versionId:chosen.versionId,status:'selected' as const,kind:'base' as const}]:[]);
 const version=current?versions.find(v=>v.versionId===choice.versionId&&v.status==='selected'):undefined;
 const selection:HistorySelection={storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor,period:{from:chosen?.from??'',to:chosen?.to??''},versionId:version?.versionId??''};
 const report=useQuery({queryKey:['new-reviewed-report',userId,storeId,HISTORY_EDITION,selection.period.from,selection.period.to,selection.versionId],enabled:!!userId&&!!chosen&&!!version,retry:false,placeholderData:undefined,queryFn:({signal})=>request('/api/history-reporting',{storeId,currency:'GBP',edition:HISTORY_EDITION,from:selection.period.from,to:selection.period.to,versionId:selection.versionId},signal)});
 const state=historyReadState(selection,report.isSuccess?report.data:null,{loading:report.isFetching,error:report.isError?'unavailable':undefined,invalidated:!!availability&&current&&!!choice.versionId&&!version});
 const month=state==='supported'&&!available.isFetching&&!available.isError?composeHistoryMonth(report.data,selection):null;
 const error=available.isError?'Reviewed months could not be loaded.':report.isError?'The selected evidence could not be checked.':state==='invalidated'?'The selected evidence version is no longer supported.':chosen&&version&&!report.isFetching&&state==='unavailable'?'This month has no supported evidence.':null;
 return {storeId,userId,month,selection,months,versions,state,loading:report.isFetching,loadingMonths:available.isFetching,error,
  selectMonth:(from:string)=>{const m=months.find(m=>m.from===from);setChoice({userId,storeId,from:m?.from??'',to:m?.to??'',versionId:''});},
  selectVersion:(versionId:string)=>setChoice({userId,storeId,from:chosen?.from??'',to:chosen?.to??'',versionId}),
  retry:()=>{void available.refetch();if(chosen&&version)void report.refetch();},
 };
}
