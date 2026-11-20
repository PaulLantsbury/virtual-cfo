import type { composeHistoryMonth } from './v11/history-composition.ts';
import type { ProfitTotals } from './newProfitPreview.ts';
type Month=NonNullable<ReturnType<typeof composeHistoryMonth>>;
/** Never reconstruct a missing cost from a reported subtotal or introduce a fixture. */
export function newProfitLiveTotals(month:Month|null):ProfitTotals|null {
 if(!month)return null;
 const s=month.input.sales,p=month.input.profit;
 if(!s||!p||p.state!=='complete')return null;
 const read=(metric:{state:string;value:number|null})=>metric.state==='ready'&&metric.value!==null&&Number.isSafeInteger(metric.value)?metric.value:null;
 const cogs=read(p.cogs),variable=read(p.variableCosts),advertising=read(p.advertising),overheads=read(p.overheads),da=read(p.da);
 const {grossProfit,contribution,ebitda,operatingProfit}=month.amounts;
 if([cogs,variable,advertising,overheads,da,grossProfit,contribution,ebitda,operatingProfit].some(v=>v===null))return null;
 const reversals=s.grossProductSales-s.discounts-s.netProductSales;
 const values={gross:s.grossProductSales,discounts:s.discounts,reversals,sales:s.netProductSales,shipping:s.netShipping,cogs:cogs!,variable:variable!,advertising:advertising!,overheads:overheads!,da:da!,orders:s.originalOrders,grossProfit:grossProfit!,contribution:contribution!,cashOverheads:overheads!-da!,ebitda:ebitda!,operatingProfit:operatingProfit!};
 if(!Object.values(values).every(Number.isSafeInteger)||reversals<0||values.sales-values.cogs!==values.grossProfit||values.grossProfit+values.shipping-values.variable-values.advertising!==values.contribution||values.contribution-values.cashOverheads!==values.ebitda||values.ebitda-values.da!==values.operatingProfit)return null;
 return values;
}
export const NEW_PROFIT_UNLINKED = ['Weekly figures','Automatic rolling and prior-year comparison selection','Action benefit estimates','Staff and product-level diagnosis','Reminders and realised benefit tracking'] as const;
/** Preserve independently supported sales when some costs are unavailable. */
export function newProfitLinkedAmounts(month:Month|null):Record<keyof ProfitTotals,number|null> {
 const empty=Object.fromEntries(['gross','discounts','reversals','sales','shipping','cogs','variable','advertising','overheads','da','orders','grossProfit','contribution','cashOverheads','ebitda','operatingProfit'].map(key=>[key,null])) as Record<keyof ProfitTotals,number|null>;
 if(!month)return empty;
 const profitConflict=month.view.primary.issues.some(issue=>/does not reconcile|profit is withheld|Profit evidence does not match|Profit and sales evidence conflict/.test(issue));
 const s=month.input.sales,p=profitConflict?null:month.input.profit;
 const safeDifference=(a:number,b:number)=>Number.isSafeInteger(a-b)?a-b:null;
 const metric=(m:{state:string;value:number|null}|undefined)=>m?.state==='ready'&&m.value!==null&&Number.isSafeInteger(m.value)?m.value:null;
 const overheads=metric(p?.overheads),da=metric(p?.da);
 return {...empty,gross:s?.grossProductSales??null,discounts:s?.discounts??null,reversals:s?safeDifference(s.grossProductSales-s.discounts,s.netProductSales):null,sales:month.amounts.netProductSales,shipping:month.amounts.netShipping,orders:month.originalOrders,cogs:metric(p?.cogs),variable:metric(p?.variableCosts),advertising:metric(p?.advertising),overheads,da,cashOverheads:overheads!==null&&da!==null?safeDifference(overheads,da):null,grossProfit:month.amounts.grossProfit,contribution:month.amounts.contribution,ebitda:month.amounts.ebitda,operatingProfit:month.amounts.operatingProfit};
}

import {changeSteps,type WaterfallStep} from './newProfitPreview.ts';
export function newProfitLiveBridge(current:Month|null,comparison:Month|null,perOrder:boolean):WaterfallStep[] {
 if(!current||!comparison||current.selection.storeId!==comparison.selection.storeId||current.selection.edition!==comparison.selection.edition||current.selection.anchor!==comparison.selection.anchor||comparison.selection.period.to>=current.selection.period.from)return [];
 const c=newProfitLiveTotals(current),p=newProfitLiveTotals(comparison);
 return c&&p?changeSteps({current:c,previous:p},perOrder):[];
}
