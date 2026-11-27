import {useQuery} from '@tanstack/react-query';
import {useReviewedSupplement} from './useReviewedSupplement';
import {useReviewedHistorySeries} from './useReviewedHistorySeries';
import type {useReviewedHistory} from './useReviewedHistory';
import {cashFinancialContext,cashSupplementView} from './cashSupplement';
import {reviewedSupplement} from './reviewedSupplement';
import {supabase} from './supabase';
import {CashWindowCurrentMismatch,cashWindowResult,readCashWindow,type CashWindowStatus} from './reviewedCashWindow';
export function useReviewedCash(history:ReturnType<typeof useReviewedHistory>){
 const supplement=useReviewedSupplement(history,'cash');
 const current=history.rangeMode?supplement.rangeCash:cashSupplementView(supplement.payload,cashFinancialContext(history.month));
 const financials=useReviewedHistorySeries(history,3);
 const windowMonths=financials.months.slice(-3);
 const enabled=!!current&&financials.status==='supported'&&windowMonths.length===3;
 const window=useQuery({queryKey:['reviewed-cash-window',history.userId,history.storeId,supplement.evidence?.snapshotId,supplement.evidence?.observedAt,current?.cash.sourceRevision,current?.cash.mappingVersion,windowMonths.map(m=>[m.selection,m.evidence.salesRevision,m.evidence.costRevision])],enabled,retry:false,placeholderData:undefined,queryFn:async({signal})=>{
  return readCashWindow(windowMonths,async month=>{
   const {data,error}=await supabase.auth.getSession();if(error||!data.session||data.session.user.id!==history.userId)throw Error('Sign-in unavailable');
   const s=month.selection,p=new URLSearchParams({storeId:s.storeId,currency:s.currency,edition:s.edition,from:s.period.from,to:s.period.to,versionId:s.versionId,kind:'cash'});
   const response=await fetch(`/api/supplemental-reporting?${p}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});if(!response.ok)throw Error('Cash history unavailable');
   return response.json();
  },(raw,month)=>{const evidence=reviewedSupplement(raw,month,'cash');const point=cashSupplementView(evidence?.payload,cashFinancialContext(month));if(!history.rangeMode&&point&&current&&month.selection.period.from===history.selection.period.from&&(evidence?.snapshotId!==supplement.evidence?.snapshotId||point.cash.sourceRevision!==current.cash.sourceRevision||point.cash.mappingVersion!==current.cash.mappingVersion||point.cash.observedAt!==current.cash.observedAt))throw new CashWindowCurrentMismatch('Selected-month cash evidence changed during the history check.');return point&&evidence?{...point,financialVersionId:month.selection.versionId,supplementalSnapshotId:evidence.snapshotId}:null;},signal);
 }});
 const currentHistoryFailed=!history.month&&!!history.error;
 const financialStatus:CashWindowStatus=history.loadingMonths||history.loading?'loading':currentHistoryFailed?'error':!history.month?'idle':financials.loading?'loading':financials.failureKind==='read-or-reconciliation'?'error':financials.status==='supported'&&windowMonths.length===3?'supported':'unavailable';
 const checked=cashWindowResult(enabled,window);
 const last=checked.months.at(-1);
 const sameCurrent=history.rangeMode?!!last:!!last&&!!current&&last.financialVersionId===history.month?.selection.versionId&&last.supplementalSnapshotId===supplement.evidence?.snapshotId&&last.cash.sourceRevision===current.cash.sourceRevision&&last.cash.mappingVersion===current.cash.mappingVersion&&last.cash.observedAt===current.cash.observedAt&&last.cash.openingBankCash===current.cash.openingBankCash&&last.cash.closingBankCash===current.cash.closingBankCash&&last.cash.operatingCash===current.cash.operatingCash;
 const currentMismatch=(checked.status==='supported'&&!sameCurrent)||window.error instanceof CashWindowCurrentMismatch;
 const result=checked.status==='supported'&&!sameCurrent?{status:'error' as const,months:[]}:checked;
 const financialWindow={status:financialStatus,error:financialStatus==='error'?(currentHistoryFailed?'The selected financial evidence could not be checked.':'The three-month financial history could not be read or verified.'):null,retry:currentHistoryFailed?history.retry:financials.retry,retryable:currentHistoryFailed||financials.retryable};
 const supplementalWindow={status:result.status,error:currentMismatch?'Selected-month cash evidence changed during the history check. Recheck both current and historical cash evidence.':result.status==='error'?'The three-month cash history could not be read or reconciled.':result.status==='unavailable'?'Matching cash evidence is unavailable for one or more of these three months.':null,retry:()=>{if(enabled){if(currentMismatch)supplement.retry();void window.refetch();}},retryable:enabled&&!window.isFetching&&(result.status==='error'||result.status==='unavailable')};
 return {...supplement,current,months:result.months,loadingWindow:financialStatus==='loading'||result.status==='loading',financialWindow,supplementalWindow};
}
