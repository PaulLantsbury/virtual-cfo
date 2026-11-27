export type HistoryRangeScope={storeId:string;currency:string;from:string;to:string};
export type HistoryRangeVersion={from:string;to:string;versionId:string};
export type HistoryRangeSelection={edition:string;versions:HistoryRangeVersion[]};
export const HISTORY_RANGE_CONTRACT:'history-range-v1';
export const SYNTHETIC_PAYROLL_ALLOCATION_POLICY:'uk-gifts-v2-monthly-payroll-recurring-v1';
export function validHistoryRangeScope(scope:unknown):scope is HistoryRangeScope;
export function requiredHistoryRangeMonths(scope:HistoryRangeScope):{from:string;to:string}[];
export function readHistoryRangeInTransaction(tx:any,scope:HistoryRangeScope,options?:{selection?:HistoryRangeSelection;now?:()=>Date;readMonth?:(tx:any,scope:HistoryRangeScope,options:any)=>Promise<any>;readSlice?:(tx:any,full:HistoryRangeScope,selection:any,part:HistoryRangeScope,options:any)=>Promise<any>;readDaily?:(scope:HistoryRangeScope,selection:HistoryRangeSelection)=>any[]}):Promise<any>;

export function validatedHistoryDaily(witness:any,scope:HistoryRangeScope,versionId:string):any[];
