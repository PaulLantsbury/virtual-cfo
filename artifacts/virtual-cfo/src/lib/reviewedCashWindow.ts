/** Atomic, read-only three-month cash window: never publish partially checked rows. */
export class CashWindowUnavailable extends Error {}
export class CashWindowCurrentMismatch extends Error {}
export async function readCashWindow<M,P extends {cash:{openingBankCash:number;closingBankCash:number}}>(
 months:readonly M[],read:(month:M)=>Promise<unknown>,validate:(raw:unknown,month:M)=>P|null,signal:AbortSignal,
):Promise<P[]> {
 if(months.length!==3)throw new CashWindowUnavailable('Three reviewed financial months are required.');
 const rows:P[]=[];
 for(const month of months){
  signal.throwIfAborted();
  const raw=await read(month);signal.throwIfAborted();
  if(raw&&typeof raw==='object'&&(raw as {state?:unknown;contract?:unknown}).state==='unavailable'&&(raw as {contract?:unknown}).contract==='reviewed-supplement-v1')throw new CashWindowUnavailable('Matching cash evidence is unavailable for one or more months.');
  const point=validate(raw,month);
  if(!point)throw Error('Cash evidence could not be verified against its financial month.');
  if(rows.length&&rows.at(-1)!.cash.closingBankCash!==point.cash.openingBankCash)throw Error('Bank history does not roll forward.');
  rows.push(point);
 }
 return rows;
}
export type CashWindowStatus='idle'|'loading'|'unavailable'|'error'|'supported';
/** Cached rows are withheld during retries, errors and disabled/changed scopes. */
export function cashWindowResult<T>(enabled:boolean,query:{isFetching:boolean;isError:boolean;isSuccess:boolean;error:unknown;data?:T[]}){
 const status:CashWindowStatus=!enabled?'idle':query.isFetching?'loading':query.isError?query.error instanceof CashWindowUnavailable?'unavailable':'error':query.isSuccess?'supported':'idle';
 return {status,months:status==='supported'?query.data??[]:[]};
}
