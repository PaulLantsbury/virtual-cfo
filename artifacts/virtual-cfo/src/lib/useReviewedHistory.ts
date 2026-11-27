import {resolveHistoryMonthVersion} from './reportingMonth';
import {useReportingSelection} from './useReportingSelection';
import {monthlyRangeSupported,reportingSourceMonth,requestedReportingRange} from './reportingRange';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveStore, useAuth } from './auth/AuthProvider';
import { supabase } from './supabase';
import { HISTORY_EDITION, historyAvailableMonths, historyReadState, type HistorySelection } from './v11/history-supported';
import { composeHistoryMonth } from './v11/history-composition';
import {advanceReviewHandoff,cancelReviewHandoff,createReviewHandoff,reviewNavigationOwnership,type ReviewHandoffRole} from './reviewHandoff';

const connectedDefaults={period:'last-month',view:'monthly',comparison:'none'} as const;
/** Dates are shared display preferences, never evidence authority. Every page
 * resolves its own current version from authenticated availability. Exact URL
 * versions remain one-shot hints, subordinate to a newer explicit date choice. */
export function useReviewedHistory({handoffRole='none',choiceRole=handoffRole==='comparison'?'comparison':'current',monthAnchorOnly=false}:{handoffRole?:ReviewHandoffRole;choiceRole?:'current'|'comparison';monthAnchorOnly?:boolean}={}) {
 const storeId=useActiveStore(), {userId}=useAuth();
 const reporting=useReportingSelection(userId,storeId,connectedDefaults);
 const sourceMonth=reportingSourceMonth(reporting.selection);
 const lastYearMonth=sourceMonth&&Number(sourceMonth.slice(0,4))>1?`${String(Number(sourceMonth.slice(0,4))-1).padStart(4,'0')}${sourceMonth.slice(4)}`:'';
 const sharedMonth=choiceRole==='comparison'?(reporting.selection.comparison==='last-year'?lastYearMonth:reporting.selection.comparisonMonth):sourceMonth;
 const monthTouched=choiceRole==='comparison'?reporting.comparisonMonthTouched:reporting.monthTouched;
 const setSharedMonth=(from:string)=>reporting.setSelection(choiceRole==='comparison'?{comparisonMonth:from}:{month:from});
 const [choice,setChoice]=useState({userId:null as string|null,storeId:'',from:'',to:'',versionId:'',origin:'month' as 'month'|'link'});
 const handoff=useRef(createReviewHandoff(typeof window==='undefined'?'':window.location.search,handoffRole));
 const [navigationKey]=useState(()=>typeof window==='undefined'?'':window.location.href);
 const [handoffWarning,setHandoffWarning]=useState<string|null>(null);
 const current=choice.userId===userId&&choice.storeId===storeId&&choice.from===sharedMonth&&(handoff.current.phase!=='applied'||reviewNavigationOwnership.allows(navigationKey,userId,storeId));
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
  // A prior page's explicit choice (including clearing the picker) wins over a
  // stale URL. The two roles are independent, so seeding current does not cancel
  // a still-valid comparison carried by the same initial link.
  if(handoff.current.phase==='pending'&&(monthTouched||(choiceRole==='comparison'&&reporting.monthTouched&&handoff.current.candidate?.current?.from!==sourceMonth))){
   handoff.current=cancelReviewHandoff(handoff.current);
   setHandoffWarning(null);
  }
  if(handoff.current.candidate&&userId&&storeId&&!reviewNavigationOwnership.register(navigationKey,userId,storeId)){
   const warning='The linked reporting context could not be restored safely. Choose a month and check the report again.';
   handoff.current={...cancelReviewHandoff(handoff.current),warning};
   setHandoffWarning(warning);
  }
  const result=advanceReviewHandoff(handoff.current,{userId,storeId,availabilityReady:!!availability,months});
  handoff.current=result.state;setHandoffWarning(result.warning);
  if(result.choice){
   setChoice({userId,storeId,...result.choice,origin:'link'});
   reporting.setSelection(choiceRole==='comparison'?{comparisonMonth:result.choice.from}:{month:result.choice.from});
   return;
  }
  if(!userId||!storeId||!availability)return;
  // Never expose a report retained from another shared date while this effect
  // catches up. `current` already gates it synchronously above.
  setChoice(previous=>{
   if(previous.userId===userId&&previous.storeId===storeId&&previous.from===sharedMonth&&previous.origin==='link')return previous;
   const m=months.find(m=>m.from===sharedMonth);
   const next={userId,storeId,from:m?.from??'',to:m?.to??'',versionId:resolveHistoryMonthVersion(m).versionId,origin:'month' as const};
   return previous.userId===next.userId&&previous.storeId===next.storeId&&previous.from===next.from&&previous.to===next.to&&previous.versionId===next.versionId&&previous.origin===next.origin?previous:next;
  });
 },[userId,storeId,availability,navigationKey,sharedMonth,sourceMonth,monthTouched,choiceRole,reporting.setSelection]);
 const chosen=current?months.find(m=>m.from===choice.from&&m.to===choice.to):undefined;
 const versions=chosen?.versions??(chosen?.versionId?[{versionId:chosen.versionId,status:'selected' as const,kind:'base' as const}]:[]);
 const authorityCurrent=choice.origin==='link'||resolveHistoryMonthVersion(chosen).versionId===choice.versionId;
 const version=current&&authorityCurrent?versions.find(v=>v.versionId===choice.versionId&&v.status==='selected'):undefined;
 const selection:HistorySelection={storeId,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor,period:{from:chosen?.from??'',to:chosen?.to??''},versionId:version?.versionId??''};
 // Until a range adapter is available, never label a one-month report as a
 // weekly/multi-month selection. Plan's explicitly labelled three-month
 // baseline uses this month only as its ending anchor.
 const requestedRange=requestedReportingRange(reporting.selection);
 // A Plan baseline is separate from the report range, but its ending month
 // must already be complete within that range: never look ahead beyond a
 // custom end date to use the remainder of an accounting month.
 const endsCompleteMonth=!!requestedRange&&new Date(`${requestedRange.to}T12:00:00Z`).getUTCDate()===new Date(Date.UTC(Number(requestedRange.to.slice(0,4)),Number(requestedRange.to.slice(5,7)),0)).getUTCDate();
 const rangeSupported=monthAnchorOnly?endsCompleteMonth:monthlyRangeSupported(reporting.selection);
 const comparisonSupported=choiceRole!=='comparison'||(reporting.selection.comparison!=='none'&&reporting.selection.comparison!=='rolling');
 const canRead=rangeSupported&&comparisonSupported;
 const report=useQuery({queryKey:['new-reviewed-report',userId,storeId,HISTORY_EDITION,selection.period.from,selection.period.to,selection.versionId],enabled:!!userId&&!!chosen&&!!version&&canRead,retry:false,placeholderData:undefined,queryFn:({signal})=>request('/api/history-reporting',{storeId,currency:'GBP',edition:HISTORY_EDITION,from:selection.period.from,to:selection.period.to,versionId:selection.versionId},signal)});
 const state=historyReadState(selection,report.isSuccess?report.data:null,{loading:report.isFetching,error:report.isError?'unavailable':undefined,invalidated:!!availability&&current&&!!choice.versionId&&!version});
 const month=canRead&&state==='supported'&&!available.isFetching&&!available.isError?composeHistoryMonth(report.data,selection):null;
 const error=available.isError?'Reviewed months could not be loaded.':availability&&months.length===0?'No reporting months could be verified for this company. Try checking again.':report.isError?'The selected evidence could not be checked.':state==='invalidated'?'The report for this month has changed. Choose the month again to check the current report.':chosen&&version&&!report.isFetching&&state==='unavailable'?'This month has no supported evidence.':chosen&&!choice.versionId?resolveHistoryMonthVersion(chosen).reason:handoffWarning;
 const manual=()=>{handoff.current=cancelReviewHandoff(handoff.current);setHandoffWarning(null);};
 return {storeId,userId,reporting,resolvedMonth:sharedMonth,rangeSupported,month,selection,months,versions,state:canRead?state:'unavailable' as const,loading:canRead&&report.isFetching,loadingMonths:available.isFetching,error:canRead?error:null,handoffWarning,
  selectMonth:(from:string)=>{manual();const m=months.find(m=>m.from===from);setSharedMonth(m?.from??'');setChoice({userId,storeId,from:m?.from??'',to:m?.to??'',versionId:resolveHistoryMonthVersion(m).versionId,origin:'month'});},
  selectVersion:(versionId:string)=>{manual();setChoice({userId,storeId,from:chosen?.from??'',to:chosen?.to??'',versionId,origin:'link'});},
  retry:()=>{void available.refetch();if(chosen&&version)void report.refetch();},
 };
}
