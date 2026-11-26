import {useQuery} from '@tanstack/react-query';
import {useReviewedHistory} from '../useReviewedHistory';
import {useReviewedHistorySeries} from '../useReviewedHistorySeries';
import {reviewedSupplement} from '../reviewedSupplement';
import {supabase} from '../supabase';
import {reviewedPlanBaseline} from './reviewed-plan-baseline';
import {acquisitionFinancialContext,acquisitionView} from '../marketing/acquisition-evidence';
import {linkedMarketingMetrics} from '../marketing/linked-model';
import {classifyPlanBaseline,type PlanBaselineMonthResult,type PlanBaselineReadResult} from './plan-baseline-evidence';

/** Three contiguous, explicitly selected reviewed months; no fixture or partial baseline. */
export function useReviewedPlanBaseline(){
 const history=useReviewedHistory(),series=useReviewedHistorySeries(history,3);
 const actuals=useReviewedHistorySeries(history,12);
 const financialIncomplete=series.months.filter(month=>{const metrics=linkedMarketingMetrics(month);return month.input.profit?.state!=='complete'||!metrics||[metrics.revenue,metrics.beforeAds,metrics.advertising,metrics.overheads].some(v=>v===null);}).map(m=>m.selection.period.from+'–'+m.selection.period.to);
 const enabled=!!history.userId&&series.status==='supported'&&series.months.length===3&&!financialIncomplete.length;
 const query=useQuery({queryKey:['reviewed-plan-baseline',history.userId,history.storeId,series.months.map(m=>({selection:m.selection,evidence:m.evidence}))],enabled,retry:false,placeholderData:undefined,
 queryFn:async({signal})=>{
  const entries=[],months:PlanBaselineMonthResult[]=[];
  for(const month of series.months){
   signal.throwIfAborted();
   try{
   const {data,error}=await supabase.auth.getSession();
   if(error||!data.session||data.session.user.id!==history.userId)throw Error('Access could not be verified.');
   const s=month.selection,p=new URLSearchParams({storeId:s.storeId,currency:s.currency,edition:s.edition,from:s.period.from,to:s.period.to,versionId:s.versionId,kind:'acquisition'});
   const response=await fetch(`/api/supplemental-reporting?${p}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});
   if(!response.ok){months.push({month,state:'read-failed',reason:'The matched acquisition source could not be read. Retry the acquisition source check.',acquisition:null,supplement:null});continue;}
   const raw=await response.json(),evidence=reviewedSupplement(raw,month,'acquisition');
   if(!evidence){months.push({month,state:'unsupported',reason:raw&&typeof raw==='object'&&raw.state==='unavailable'?'No matched acquisition evidence is available for this month.':'The acquisition source did not match this exact financial version and revisions.',acquisition:null,supplement:null});continue;}
   const supplement={snapshotId:evidence.snapshotId,observedAt:evidence.observedAt,financialVersionId:evidence.financialVersionId,salesRevision:evidence.salesRevision,costRevision:evidence.costRevision};
   const view=acquisitionView(evidence.payload,acquisitionFinancialContext(month));
   if(!view||!view.economicsView||!view.economics?.first||view.economics.first.acquisitionMetricsState!=='supported'||view.coverage.paidFirstCustomers<=0){months.push({month,state:'unsupported',reason:!view?'The customer/acquisition payload failed its matching-source validation.':'Matched first-order cost allocation and paid acquisition inputs are unavailable for this month.',acquisition:null,supplement});continue;}
   entries.push({month,acquisition:evidence.payload});months.push({month,state:'supported',reason:null,acquisition:evidence.payload,supplement});
   }catch(error){if(signal.aborted)throw error;months.push({month,state:'read-failed',reason:'The matched acquisition read failed or sign-in could not be verified. Retry the source check.',acquisition:null,supplement:null});}
  }
  const baseline=entries.length===3?reviewedPlanBaseline(entries):null;
  return {baseline,months} satisfies PlanBaselineReadResult;
 }});
 const result=enabled&&query.isSuccess&&!query.isFetching&&!query.isError?query.data:null;
 const status=classifyPlanBaseline({hasMonth:!!history.selection.period.from,hasVersion:!!history.selection.versionId,hasReviewedMonth:!!history.month,historyLoading:history.loading||history.loadingMonths,historyError:history.error,seriesStatus:series.status,seriesFailure:series.failureKind,financialMonths:series.months.length,financialIncomplete,acquisitionLoading:enabled&&query.isFetching,acquisitionError:enabled&&query.isError,result});
 const retryFinancial=()=>{history.retry();series.retry();};
 const retryAcquisition=()=>{if(enabled)void query.refetch();};
 return {history,actualMonths:actuals.months,actualsStatus:actuals.status,actualsError:actuals.error,retryActuals:actuals.retry,financialMonths:series.months,acquisitionMonths:result?.months??[],baseline:result?.baseline??null,status,
 loading:status.kind==='loading',retryFinancial,retryAcquisition,
 retry:()=>{retryFinancial();retryAcquisition();actuals.retry();}};
}
