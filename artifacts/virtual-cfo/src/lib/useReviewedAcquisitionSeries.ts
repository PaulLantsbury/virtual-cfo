import {useQuery} from '@tanstack/react-query';
import {supabase} from './supabase';
import {useAuth} from './auth/AuthProvider';
import type {useReviewedHistory} from './useReviewedHistory';
import {useReviewedHistorySeries} from './useReviewedHistorySeries';
import {readAcquisitionSeries} from './reviewedAcquisitionSeries';
export function useReviewedAcquisitionSeries(history:ReturnType<typeof useReviewedHistory>,count:number){
 const auth=useAuth(),financial=useReviewedHistorySeries(history,count),enabled=auth.status==='ready'&&auth.userId===history.userId&&financial.status==='supported';
 const query=useQuery({queryKey:['reviewed-acquisition-series',history.userId,history.storeId,auth.revision,financial.months.map(m=>[m.selection,m.evidence.salesRevision,m.evidence.costRevision])],enabled,retry:false,placeholderData:undefined,staleTime:0,
  queryFn:({signal})=>readAcquisitionSeries(financial.months,async(month,abort)=>{
   const {data,error}=await supabase.auth.getSession();abort.throwIfAborted();
   if(error||!data.session||data.session.user.id!==history.userId)throw Error('Access could not be verified.');
   const s=month.selection,p=new URLSearchParams({storeId:s.storeId,currency:s.currency,edition:s.edition,from:s.period.from,to:s.period.to,versionId:s.versionId,kind:'acquisition'});
   const r=await fetch(`/api/supplemental-reporting?${p}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal:abort});
   if(!r.ok)throw Error('Monthly source unavailable.');return r.json();
  },signal)});
 const supported=enabled&&query.isSuccess&&!query.isFetching&&!query.isError;
 return {rows:supported?query.data:[],supported,loading:financial.loading||enabled&&query.isFetching,retry:()=>{if(enabled)void query.refetch();else financial.retry();}};
}
