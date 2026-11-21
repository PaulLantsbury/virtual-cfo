import type {acquisitionView} from './acquisition-evidence.ts';
type Acquisition=NonNullable<ReturnType<typeof acquisitionView>>;
/** Both arguments must already have passed the exact financial/supplement validator.
 * A historical comparison never pools distinct customers across months. */
export function comparableAcquisition(current:Acquisition|null,prior:Acquisition|null):Acquisition|null {
 if(!current||!prior||current.scope.storeId!==prior.scope.storeId||current.scope.currency!==prior.scope.currency||current.scope.timezone!==prior.scope.timezone||prior.scope.to>=current.scope.from)return null;
 return prior;
}
export function customerComparisonRows(current:Acquisition|null,prior:Acquisition|null){
 const previous=comparableAcquisition(current,prior);
 const measures=(v:Acquisition|null)=>[v?.customerActivity?.identifiedCustomers??null,v?.customerActivity?.uniqueReturningCustomers??null,v?.customerActivity?.identifiedOrders??null,v?.customerActivityView?.purchaseFrequency??null];
 const a=measures(current),b=measures(previous);
 return ['Distinct identified customers','Unique customers with a repeat order','Identified orders','Orders per identified customer'].map((label,i)=>({label,current:a[i],prior:b[i],difference:a[i]!==null&&b[i]!==null?a[i]!-b[i]!:null,frequency:i===3}));
}
