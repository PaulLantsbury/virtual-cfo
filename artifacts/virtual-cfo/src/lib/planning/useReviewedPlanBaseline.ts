import {useQuery} from '@tanstack/react-query';
import {useReviewedHistory} from '../useReviewedHistory';
import {useReviewedHistorySeries} from '../useReviewedHistorySeries';
import {reviewedSupplement} from '../reviewedSupplement';
import {supabase} from '../supabase';
import {reviewedPlanBaseline} from './reviewed-plan-baseline';

/** Three contiguous, explicitly selected reviewed months; no fixture or partial baseline. */
export function useReviewedPlanBaseline(){
 const history=useReviewedHistory(),series=useReviewedHistorySeries(history,3);
 const actuals=useReviewedHistorySeries(history,12);
 const enabled=!!history.userId&&series.status==='supported'&&series.months.length===3;
 const query=useQuery({queryKey:['reviewed-plan-baseline',history.userId,history.storeId,series.months.map(m=>({selection:m.selection,evidence:m.evidence}))],enabled,retry:false,placeholderData:undefined,
 queryFn:async({signal})=>{
  const entries=[];
  for(const month of series.months){
   signal.throwIfAborted();
   const {data,error}=await supabase.auth.getSession();
   if(error||!data.session||data.session.user.id!==history.userId)throw Error('Access could not be verified.');
   const s=month.selection,p=new URLSearchParams({storeId:s.storeId,currency:s.currency,edition:s.edition,from:s.period.from,to:s.period.to,versionId:s.versionId,kind:'acquisition'});
   const response=await fetch(`/api/supplemental-reporting?${p}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});
   if(!response.ok)throw Error('Matched acquisition evidence is unavailable.');
   const evidence=reviewedSupplement(await response.json(),month,'acquisition');
   if(!evidence)throw Error('Matched acquisition evidence could not be verified.');
   entries.push({month,acquisition:evidence.payload});
  }
  const baseline=reviewedPlanBaseline(entries);
  if(!baseline)throw Error('Three complete financial and customer-economics months are required.');
  return baseline;
 }});
 return {history,actualMonths:actuals.months,baseline:enabled&&query.isSuccess&&!query.isFetching&&!query.isError?query.data:null,
 loading:history.loading||history.loadingMonths||series.loading||(enabled&&query.isFetching),
 retry:()=>{history.retry();series.retry();if(enabled)void query.refetch();}};
}
