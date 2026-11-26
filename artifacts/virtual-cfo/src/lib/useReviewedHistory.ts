import {resolveHistoryMonthVersion} from './reportingMonth';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveStore, useAuth } from './auth/AuthProvider';
import { supabase } from './supabase';
import { HISTORY_EDITION, historyAvailableMonths, historyReadState, type HistorySelection } from './v11/history-supported';
import { composeHistoryMonth } from './v11/history-composition';
import {advanceReviewHandoff,cancelReviewHandoff,createReviewHandoff,reviewNavigationOwnership,type ReviewHandoffRole} from './reviewHandoff';

/** Read-only explicit month/version selection. Recipient opt-ins can seed a
 * validated link once per mount; manual choices win until reload. The URL stays
 * bookmarkable; new mounts revalidate exact evidence without replaying a URL
 * after its user/company ownership has changed during this application lifetime. */
export function useReviewedHistory({handoffRole='none'}:{handoffRole?:ReviewHandoffRole}={}) {
 const storeId=useActiveStore(), {userId}=useAuth();
 const [choice,setChoice]=useState({userId:null as string|null,storeId:'',from:'',to:'',versionId:'',origin:'month' as 'month'|'link'});
 const handoff=useRef(createReviewHandoff(typeof window==='undefined'?'':window.location.search,handoffRole));
 const [navigationKey]=useState(()=>typeof window==='undefined'?'':window.location.href);
 const [handoffWarning,setHandoffWarning]=useState<string|null>(null);
 const current=choice.userId===userId&&choice.storeId===storeId&&(handoff.current.phase!=='applied'||reviewNavigationOwnership.allows(navigationKey,userId,storeId));
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
 useEffect(()=>{
  if(handoff.current.candidate&&userId&&storeId&&!reviewNavigationOwnership.register(navigationKey,userId,storeId)){
   const warning='The linked reporting context could not be restored safely. Choose a month and check the report again.';
   handoff.current={...cancelReviewHandoff(handoff.current),warning};
   setChoice({userId,storeId,from:'',to:'',versionId:'',origin:'month'});
   setHandoffWarning(warning);
   return;
  }
  const result=advanceReviewHandoff(handoff.current,{userId,storeId,availabilityReady:!!availability,months});
  handoff.current=result.state;setHandoffWarning(result.warning);
  if(result.choice)setChoice({userId,storeId,...result.choice,origin:'link'});
 },[userId,storeId,availability,navigationKey]);
 const chosen=current?months.find(m=>m.from===choice.from&&m.to===choice.to):undefined;
 const versions=chosen?.versions??(chosen?.versionId?[{versionId:chosen.versionId,status:'selected' as const,kind:'base' as const}]:[]);
 const authorityCurrent=choice.origin==='link'||resolveHistoryMonthVersion(chosen).versionId===choice.versionId;
 const version=current&&authorityCurrent?versions.find(v=>v.versionId===choice.versionId&&v.status==='selected'):undefined;
 const selection:HistorySelection={storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor,period:{from:chosen?.from??'',to:chosen?.to??''},versionId:version?.versionId??''};
 const report=useQuery({queryKey:['new-reviewed-report',userId,storeId,HISTORY_EDITION,selection.period.from,selection.period.to,selection.versionId],enabled:!!userId&&!!chosen&&!!version,retry:false,placeholderData:undefined,queryFn:({signal})=>request('/api/history-reporting',{storeId,currency:'GBP',edition:HISTORY_EDITION,from:selection.period.from,to:selection.period.to,versionId:selection.versionId},signal)});
 const state=historyReadState(selection,report.isSuccess?report.data:null,{loading:report.isFetching,error:report.isError?'unavailable':undefined,invalidated:!!availability&&current&&!!choice.versionId&&!version});
 const month=state==='supported'&&!available.isFetching&&!available.isError?composeHistoryMonth(report.data,selection):null;
 const error=available.isError?'Reviewed months could not be loaded.':availability&&months.length===0?'No reporting months could be verified for this company. Try checking again.':report.isError?'The selected evidence could not be checked.':state==='invalidated'?'The report for this month has changed. Choose the month again to check the current report.':chosen&&version&&!report.isFetching&&state==='unavailable'?'This month has no supported evidence.':chosen&&!choice.versionId?resolveHistoryMonthVersion(chosen).reason:handoffWarning;
 const manual=()=>{handoff.current=cancelReviewHandoff(handoff.current);setHandoffWarning(null);};
 return {storeId,userId,month,selection,months,versions,state,loading:report.isFetching,loadingMonths:available.isFetching,error,handoffWarning,
  selectMonth:(from:string)=>{manual();const m=months.find(m=>m.from===from);setChoice({userId,storeId,from:m?.from??'',to:m?.to??'',versionId:resolveHistoryMonthVersion(m).versionId,origin:'month'});},
  selectVersion:(versionId:string)=>{manual();setChoice({userId,storeId,from:chosen?.from??'',to:chosen?.to??'',versionId,origin:'link'});},
  retry:()=>{void available.refetch();if(chosen&&version)void report.refetch();},
 };
}
