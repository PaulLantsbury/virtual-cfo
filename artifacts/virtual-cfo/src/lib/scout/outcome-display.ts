import type {ScoutOutcome} from './overview-model.ts';
/** Per-order financial comparisons use each period's own eligible orders.
 * Cash flows and bank balances retain their absolute pound basis. */
export function scoutOutcomeDisplay(outcome:ScoutOutcome,context:{perOrder:boolean;currentOrders:number|null|undefined;previousOrders:number|null|undefined}){
 const perOrder=context.perOrder&&['sales','contribution','ebitda'].includes(outcome.id);
 const ratio=(value:number|null,orders:number|null|undefined)=>value!==null&&Number.isSafeInteger(orders)&&orders!>0?value/orders!:null;
 const value=perOrder?ratio(outcome.value,context.currentOrders):outcome.value;
 const previous=perOrder?ratio(outcome.previous,context.previousOrders):outcome.previous;
 return {perOrder,value,previous,delta:value!==null&&previous!==null?value-previous:null};
}
