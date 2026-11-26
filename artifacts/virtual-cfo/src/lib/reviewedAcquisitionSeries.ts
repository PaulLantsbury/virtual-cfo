import {reviewedSupplement} from './reviewedSupplement.ts';
import {acquisitionFinancialContext,acquisitionView} from './marketing/acquisition-evidence.ts';
import type {ReviewedMonth} from './reviewedHistorySeries.ts';
/** Financial months are already independently validated by readReviewedSeries.
 * Every supplemental row is then bound to its own exact month and revisions. */
export async function readAcquisitionSeries(months:ReviewedMonth[],read:(month:ReviewedMonth,signal:AbortSignal)=>Promise<unknown>,signal:AbortSignal){
 if(months.length<2||months.length>12)throw Error('Choose a supported monthly history.');
 const rows=[];
 for(const month of months){
  signal.throwIfAborted();
  const raw=await read(month,signal);signal.throwIfAborted();
  const envelope=reviewedSupplement(raw,month,'acquisition');
  const view=envelope?acquisitionView(envelope.payload,acquisitionFinancialContext(month)):null;
  if(!view)throw Error('A monthly acquisition source could not be verified.');
  rows.push({from:month.selection.period.from,to:month.selection.period.to,version:month.selection.versionId,snapshotId:envelope!.snapshotId as string,observedAt:envelope!.observedAt as string,
   sessions:view.analytics?.totals.sessions??null,purchasingSessions:view.analytics?.totals.purchasingSessions??null,conversion:view.funnel?.conversion??null,
   acquisitionSpend:view.spend.acquisition,paidFirstCustomers:view.coverage.paidFirstCustomers,cac:view.cac,sessionPolicy:view.analytics?.policy??null});
 }
 return rows;
}
