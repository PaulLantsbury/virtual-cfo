import {useQuery} from '@tanstack/react-query';
import {supabase} from './supabase';
import type {useReviewedHistory} from './useReviewedHistory';
import {resolveHistoryMonthVersion} from './reportingMonth';
import {readReviewedSeries, reviewedSeriesSelections} from './reviewedHistorySeries';

/** Uses the explicit page month/version; never chooses a reporting month or fills a source gap. */
export function useReviewedHistorySeries(history:ReturnType<typeof useReviewedHistory>, count=12){
 const anchor=history.anchorMonth?.selection;
 const complete=history.rangeMode&&anchor?history.months.filter(m=>m.to<=history.selection.period.to).at(-1):null;
 const seriesAnchor=history.rangeMode?(complete&&anchor?{...anchor,period:{from:complete.from,to:complete.to},versionId:resolveHistoryMonthVersion(complete).versionId}:null):anchor;
 const selections=history.month&&seriesAnchor&&!history.loadingMonths&&!history.error?reviewedSeriesSelections(history.months,seriesAnchor,count):[];
 const enabled=!!history.userId&&!!history.month&&selections.length>=2;
 const query=useQuery({
  queryKey:['new-reviewed-series',history.userId,history.storeId,history.selection.edition,history.selection.anchor,selections],
  enabled,retry:false,placeholderData:undefined,staleTime:0,
  queryFn:({signal})=>readReviewedSeries(selections,async selection=>{
   const {data,error}=await supabase.auth.getSession();
   if(error||!data.session||data.session.user.id!==history.userId)throw Error('Access to this business could not be verified.');
   const params=new URLSearchParams({storeId:selection.storeId,currency:selection.currency,edition:selection.edition,from:selection.period.from,to:selection.period.to,versionId:selection.versionId});
   const response=await fetch(`/api/history-reporting?${params}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});
   if(!response.ok)throw Error('The monthly history could not be checked.');
   return response.json();
  },signal),
 });
 const supported=enabled&&query.isSuccess&&!query.isFetching&&!query.isError;
 const status=!history.month?'idle':!enabled?'unavailable':query.isFetching?'loading':supported?'supported':'unavailable';
 return {months:supported?query.data:[],status:status as 'idle'|'loading'|'supported'|'unavailable',loading:enabled&&query.isFetching,
  failureKind:(enabled&&query.isError&&!query.isFetching?'read-or-reconciliation':history.month&&!enabled?'coverage':null) as 'coverage'|'read-or-reconciliation'|null,
  retryable:enabled&&query.isError&&!query.isFetching,
  error:status==='unavailable'?'Continuous reviewed monthly history is unavailable. No example figures have been substituted.':null,
  retry:()=>{if(enabled)void query.refetch();}};
}
