import {useQuery} from '@tanstack/react-query';
import {supabase} from './supabase';
import type {useReviewedHistory} from './useReviewedHistory';
import {reviewedSupplement} from './reviewedSupplement';
export function useReviewedSupplement(history:ReturnType<typeof useReviewedHistory>,kind:'cash'|'acquisition'){
 const m=history.month,s=history.selection;
 const enabled=!!m&&!history.error&&!history.loadingMonths&&!history.loading;
 const query=useQuery({queryKey:['reviewed-supplement',history.userId,history.storeId,kind,s,m?.evidence.salesRevision,m?.evidence.costRevision],enabled,retry:false,placeholderData:undefined,
  queryFn:async({signal})=>{const {data,error}=await supabase.auth.getSession();if(error||!data.session||data.session.user.id!==history.userId)throw Error('Sign-in could not be verified');
   const p=new URLSearchParams({storeId:s.storeId,currency:s.currency,edition:s.edition,from:s.period.from,to:s.period.to,versionId:s.versionId,kind});
   const response=await fetch(`/api/supplemental-reporting?${p}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});if(!response.ok)throw Error('Additional evidence unavailable');return response.json();}});
 const evidence=enabled&&query.isSuccess&&!query.isFetching&&!query.isError?reviewedSupplement(query.data,m,kind):null;
 return {evidence,payload:evidence?.payload??null,loading:enabled&&query.isFetching,error:enabled&&!query.isFetching&&!evidence?'Additional source evidence is not available for this reviewed month.':null,retry:()=>{if(enabled)void query.refetch();}};
}
