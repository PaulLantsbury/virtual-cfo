import {useQuery} from '@tanstack/react-query';
import {supabase} from './supabase';
import type {useReviewedHistory} from './useReviewedHistory';
import type {composeReviewedRange} from './reporting-range/composition';
import {reviewedSupplement} from './reviewedSupplement';
import {composeCashRange,composeAcquisitionRange} from './reporting-range/supplements';

/** Every supplement is read with its original monthly authority. Composite
 * ranges have distinct view contracts; their digest is never a monthly UUID. */
export function useReviewedSupplement(history:ReturnType<typeof useReviewedHistory>,kind:'cash'|'acquisition'){
 const m=history.month,s=history.selection;
 const range=history.rangeMode&&m&&'range' in m?m as NonNullable<ReturnType<typeof composeReviewedRange>>:null;
 const enabled=!!m&&!history.error&&!history.loadingMonths&&!history.loading;
 const read=async(selection:typeof s,signal:AbortSignal)=>{
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session||data.session.user.id!==history.userId)throw Error('Sign-in could not be verified');
  const p=new URLSearchParams({storeId:selection.storeId,currency:selection.currency,edition:selection.edition,from:selection.period.from,to:selection.period.to,versionId:selection.versionId,kind});
  const response=await fetch(`/api/supplemental-reporting?${p}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});
  if(!response.ok)throw Error('Additional evidence unavailable');return response.json();
 };
 const query=useQuery({queryKey:['reviewed-supplement',history.userId,history.storeId,kind,s,m?.evidence.salesRevision,m?.evidence.costRevision],enabled:enabled&&!history.rangeMode,retry:false,placeholderData:undefined,queryFn:({signal})=>read(s,signal)});
 const rangeQuery=useQuery({queryKey:['reviewed-range-supplement',history.userId,history.storeId,kind,s,range?.range.versions],enabled:enabled&&!!range,retry:false,placeholderData:undefined,
  queryFn:async({signal})=>{
   if(!range)throw Error('Range unavailable');
   // Sequential bounded reads avoid flooding the small staging database.
   const raw:unknown[]=[];
   for(const month of range.range.months){if(signal.aborted)throw Error('Cancelled');raw.push(await read(month.selection,signal));}
   return kind==='cash'?{cash:await composeCashRange(range.range.months,raw,range),acquisition:null}:{cash:null,acquisition:await composeAcquisitionRange(range.range.months,raw,range)};
  }});
 const evidence=enabled&&!history.rangeMode&&query.isSuccess&&!query.isFetching&&!query.isError?reviewedSupplement(query.data,m,kind):null;
 const checkedRange=enabled&&!!range&&rangeQuery.isSuccess&&!rangeQuery.isFetching&&!rangeQuery.isError?rangeQuery.data:null;
 const rangeCash=checkedRange?.cash??null,rangeAcquisition=checkedRange?.acquisition??null;
 const active=history.rangeMode?rangeQuery:query,accepted=history.rangeMode?!!(kind==='cash'?rangeCash:rangeAcquisition):!!evidence;
 return {evidence,payload:evidence?.payload??null,rangeCash,rangeAcquisition,loading:enabled&&active.isFetching,error:enabled&&!active.isFetching&&!accepted?'Matching additional source records are not available for this selected period.':null,retry:()=>{if(enabled)void active.refetch();}};
}
