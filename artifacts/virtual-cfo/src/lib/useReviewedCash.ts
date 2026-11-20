import {useQuery} from '@tanstack/react-query';
import {useReviewedSupplement} from './useReviewedSupplement';
import {useReviewedHistorySeries} from './useReviewedHistorySeries';
import type {useReviewedHistory} from './useReviewedHistory';
import {cashFinancialContext,cashSupplementView} from './cashSupplement';
import {reviewedSupplement} from './reviewedSupplement';
import {supabase} from './supabase';
export function useReviewedCash(history:ReturnType<typeof useReviewedHistory>){
 const supplement=useReviewedSupplement(history,'cash');
 const current=cashSupplementView(supplement.payload,cashFinancialContext(history.month));
 const financials=useReviewedHistorySeries(history,12);
 const windowMonths=financials.months.slice(-3);
 const enabled=!!current&&financials.status==='supported'&&windowMonths.length===3;
 const window=useQuery({queryKey:['reviewed-cash-window',history.userId,history.storeId,windowMonths.map(m=>[m.selection,m.evidence.salesRevision,m.evidence.costRevision])],enabled,retry:false,placeholderData:undefined,queryFn:async({signal})=>{
  const rows=[];
  for(const month of windowMonths){
   const {data,error}=await supabase.auth.getSession();if(error||!data.session||data.session.user.id!==history.userId)throw Error('Sign-in unavailable');
   const s=month.selection,p=new URLSearchParams({storeId:s.storeId,currency:s.currency,edition:s.edition,from:s.period.from,to:s.period.to,versionId:s.versionId,kind:'cash'});
   const response=await fetch(`/api/supplemental-reporting?${p}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});if(!response.ok)throw Error('Cash history unavailable');
   const raw=reviewedSupplement(await response.json(),month,'cash');const point=cashSupplementView(raw?.payload,cashFinancialContext(month));if(!point)throw Error('Cash history incomplete');
   if(rows.length&&rows.at(-1)!.cash.closingBankCash!==point.cash.openingBankCash)throw Error('Bank history does not roll forward');
   rows.push({...point,financialVersionId:month.selection.versionId});
  }return rows;
 }});
 return {...supplement,current,months:enabled&&window.isSuccess&&!window.isFetching&&!window.isError?window.data:[],loadingWindow:enabled&&window.isFetching};
}
