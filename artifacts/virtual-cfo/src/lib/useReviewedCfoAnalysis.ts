import {useLayoutEffect,useRef,useState} from 'react';
import {useAuth} from './auth/AuthProvider';
import {supabase} from './supabase';
import type {useReviewedHistory} from './useReviewedHistory';
import {composeHistoryMonth} from './v11/history-composition';
import type {HistorySelection} from './v11/history-supported';
import {immediatelyPriorSelection,reviewedCfoAnalysis,type CheckedAnalysis} from './reviewedCfoAnalysis';
type State={key:string;status:'loading'|'unavailable'|'ready';view:CheckedAnalysis|null};
/** No answer cache: authority changes synchronously hide old output; each check
 * re-reads the immediately preceding canonical month before accepting analysis. */
export function useReviewedCfoAnalysis(history:ReturnType<typeof useReviewedHistory>){
 const auth=useAuth(),month=history.month;
 const eligible=auth.status==='ready'&&auth.userId===history.userId&&auth.storeId===history.storeId&&!!month&&!history.loading&&!history.loadingMonths&&!history.error;
 const prior=eligible?immediatelyPriorSelection(month!,history.months):null;
 const [attempt,setAttempt]=useState(0),[state,setState]=useState<State>({key:'',status:'unavailable',view:null});
 const key=JSON.stringify([auth.status,auth.userId,auth.storeId,auth.revision,eligible&&month?[month.selection,month.evidence]:null,prior,attempt]);
 const active=useRef(key);active.current=key;
 useLayoutEffect(()=>{
  const abort=new AbortController();let stopped=false;const update=(status:State['status'],view:CheckedAnalysis|null=null)=>{if(!stopped&&!abort.signal.aborted&&active.current===key)setState({key,status,view});};
  if(!eligible||!month||!prior){setState({key,status:'unavailable',view:null});return ()=>abort.abort();}
  update('loading');
  const timeout=setTimeout(()=>{update('unavailable');abort.abort();},20000);
  const read=async(path:string,selection:HistorySelection)=>{
   const {data,error}=await supabase.auth.getSession();abort.signal.throwIfAborted();
   if(error||!data.session||data.session.user.id!==auth.userId||active.current!==key)throw Error('Access unavailable');
   const query=new URLSearchParams({storeId:selection.storeId,currency:selection.currency,edition:selection.edition,from:selection.period.from,to:selection.period.to,versionId:selection.versionId});
   const result=await fetch(path+'?'+query,{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:'no-store',signal:abort.signal});
   if(!result.ok)throw Error('Evidence unavailable');const text=await result.text();abort.signal.throwIfAborted();if(new TextEncoder().encode(text).length>1048576)throw Error('Evidence unavailable');return JSON.parse(text) as unknown;
  };
  void(async()=>{try{
   const previous=composeHistoryMonth(await read('/api/history-reporting',prior),prior);if(!previous)throw Error('Prior unavailable');
   const wire=await read('/api/history-reporting/analysis',month.selection);abort.signal.throwIfAborted();
   const view=reviewedCfoAnalysis(wire,month,previous);update(view?'ready':'unavailable',view);
  }catch{update('unavailable');}finally{clearTimeout(timeout);}})();
  return ()=>{stopped=true;clearTimeout(timeout);abort.abort();};
 },[key]);
 return {status:state.key===key?state.status:eligible&&prior?'loading':'unavailable',view:state.key===key&&eligible?state.view:null,retry:()=>setAttempt(n=>n+1)};
}
