/** Illustrative monthly reconciliation, never inferred from connected report snapshots.
 * Integer pence. Operating profit includes D&A, excludes interest/corporation tax.
 * Operating cash is before corporation tax and interest; VAT is operating working capital.
 */
import { DAILY_SAMPLE, aggregateDays } from './newProfitPreview.ts';
export type CashComparison='previous-period'|'last-year';
export type CashAdjustments={nonCash:number;stock:number;receivables:number;settlements:number;payables:number;otherWorkingCapital:number};
export type CashReconciliationInput={operatingProfit:number|null;adjustments:{[K in keyof CashAdjustments]:number|null};operatingCash:number|null;tax:number|null;investment:number|null;financing:number|null;otherBankMovements:number|null;openingCash:number|null;closingCash:number|null};
export type CashBridgeStep={id:string;label:string;amount:number;start:number;end:number;subtotal:boolean};
const labels:Record<keyof CashAdjustments,string>={nonCash:'Non-cash adjustments',stock:'Stock movement',receivables:'Customer receivables',settlements:'Unsettled payment-provider funds',payables:'Supplier payables',otherWorkingCapital:'Other operating working capital'};
const valid=(value:number|null):value is number=>value!==null&&Number.isSafeInteger(value);
export function reconcileCash(input:CashReconciliationInput){
 const missing:string[]=[];for(const key of ['operatingProfit','adjustments','operatingCash','tax','investment','financing','otherBankMovements','openingCash','closingCash']as const){const value=input[key];if(key==='adjustments'){for(const k of Object.keys(labels)as(keyof CashAdjustments)[])if(!valid(input.adjustments[k]))missing.push(k);}else if(!valid(value as number|null))missing.push(key);}
 const adjustmentValues=(Object.keys(labels)as(keyof CashAdjustments)[]).map(key=>input.adjustments[key]),canOperating=valid(input.operatingProfit)&&adjustmentValues.every(valid);
 // Check each intermediate addition: accepting a rounded final value would hide
 // overflow even when a subsequent negative movement returns within range.
 let arithmeticOverflow=false;
 function boundedSum(values:number[]):number|null{let total=0;for(const value of values){const next=total+value;if(!Number.isSafeInteger(next)){arithmeticOverflow=true;return null;}total=next;}return total;}
 const calculatedOperatingCash=canOperating?boundedSum([input.operatingProfit!,...(adjustmentValues as number[])]):null;
 const operatingResidual=calculatedOperatingCash!==null&&valid(input.operatingCash)?boundedSum([input.operatingCash,-calculatedOperatingCash]):null;
 const bankParts=[input.operatingCash,input.tax,input.investment,input.financing,input.otherBankMovements];
 const calculatedBankChange=bankParts.every(valid)?boundedSum(bankParts as number[]):null;
 const bankChange=valid(input.openingCash)&&valid(input.closingCash)?boundedSum([input.closingCash,-input.openingCash]):null;
 const bankResidual=bankChange!==null&&calculatedBankChange!==null?boundedSum([bankChange,-calculatedBankChange]):null;
 const bridge:CashBridgeStep[]=[],bankBridge:CashBridgeStep[]=[];
 function step(rows:CashBridgeStep[],id:string,label:string,amount:number,subtotal=false){const start=subtotal?0:(rows.at(-1)?.end??0);const end=subtotal?amount:boundedSum([start,amount]);if(end!==null)rows.push({id,label,amount,start,end,subtotal});}
 if(valid(input.operatingProfit)){step(bridge,'profit','Operating profit',input.operatingProfit,true);for(const key of Object.keys(labels)as(keyof CashAdjustments)[])if(valid(input.adjustments[key]))step(bridge,key,labels[key],input.adjustments[key]!);if(operatingResidual)step(bridge,'unreconciled','Unreconciled operating movement',operatingResidual);if(valid(input.operatingCash))step(bridge,'operatingCash','Operating cash generated',input.operatingCash,true);}
 if(valid(input.operatingCash)){step(bankBridge,'operatingCash','Operating cash generated',input.operatingCash,true);for(const[key,label]of [['tax','Corporation tax and interest'],['investment','Investment'],['financing','Borrowing and owner funding'],['otherBankMovements','Other bank movements']]as const)if(valid(input[key]))step(bankBridge,key,label,input[key]!);if(bankResidual)step(bankBridge,'unreconciledBank','Unreconciled bank movement',bankResidual);if(bankChange!==null)step(bankBridge,'bankChange','Change in bank cash',bankChange,true);}
 if(arithmeticOverflow){missing.push('arithmeticOverflow');bridge.length=0;bankBridge.length=0;}
 return {state:missing.length?'incomplete':operatingResidual!==0||bankResidual!==0?'unreconciled':'reconciled',missing,calculatedOperatingCash,operatingResidual,calculatedBankChange,bankChange,bankResidual,bridge,bankBridge}as const;
}
const monthShift=(date:string,count:number)=>{const d=new Date(date+'T00:00:00Z');return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+count,1)).toISOString().slice(0,10);};
const dayBefore=(date:string)=>new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
export function sampleMonth(from:string,allowIncomplete=false){
 const end=monthShift(from,1),days=DAILY_SAMPLE.filter(row=>row.date>=from&&row.date<end);if(!allowIncomplete&&days.length!==(Date.parse(end)-Date.parse(from))/86400000)throw Error('Sample accounting month incomplete');
 const p=aggregateDays(days),m=new Date(from+'T00:00:00Z').getUTCMonth(),year=Number(from.slice(0,4));
 // Independent illustrative balance-sheet movements, signed cash effects. Stock is
 // inventory movement, NOT supplier payments; payable movement is applied separately.
 const adjustments:CashAdjustments={nonCash:p.da,stock:-(year===2026&&m>=6?3_800_000:1_200_000),receivables:m%2===0?-170_000:120_000,settlements:m%3===0?-290_000:80_000,payables:m%2===0?1_100_000:-350_000,otherWorkingCapital:m%3===0?-140_000:70_000};
 const operatingCash=p.operatingProfit+Object.values(adjustments).reduce((a,b)=>a+b,0),tax=m%3===2?-900_000:-80_000,investment=m===7?-1_200_000:-100_000,financing=year===2026&&m===7?2_000_000:0,otherBankMovements=0;
 return {from,to:dayBefore(end),label:new Date(from+'T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}),sales:p.sales,operatingProfit:p.operatingProfit,adjustments,operatingCash,tax,investment,financing,otherBankMovements};
}
const months=Array.from({length:24},(_,i)=>sampleMonth(monthShift('2024-10-01',i)));
const endingCash=18_000_000,totalMovement=months.reduce((sum,r)=>sum+r.operatingCash+r.tax+r.investment+r.financing+r.otherBankMovements,0);
let running=endingCash-totalMovement;
const history=months.map(row=>{const openingCash=running;running+=row.operatingCash+row.tax+row.investment+row.financing+row.otherBankMovements;return {...row,openingCash,closingCash:running,complete:true as const};});
export type CashPerformanceMonth=typeof history[number];
function sumRows(rows:CashPerformanceMonth[]){
 const adjustments=Object.fromEntries(Object.keys(labels).map(key=>[key,rows.reduce((s,r)=>s+r.adjustments[key as keyof CashAdjustments],0)]))as CashAdjustments;
 const sum=(key:'sales'|'operatingProfit'|'operatingCash'|'tax'|'investment'|'financing'|'otherBankMovements')=>rows.reduce((s,r)=>s+r[key],0);
 return {from:rows[0].from,to:rows.at(-1)!.to,sales:sum('sales'),operatingProfit:sum('operatingProfit'),operatingCash:sum('operatingCash'),tax:sum('tax'),investment:sum('investment'),financing:sum('financing'),otherBankMovements:sum('otherBankMovements'),adjustments,openingCash:rows[0].openingCash,closingCash:rows.at(-1)!.closingCash};
}
export function buildCashPerformance({months=3,comparison='previous-period'}:{months?:3|6|12;comparison?:CashComparison}={}){
 if(![3,6,12].includes(months)||!['previous-period','last-year'].includes(comparison))throw Error('Invalid cash performance controls');
 const selectedRows=history.slice(-months),comparisonRows=comparison==='last-year'?history.slice(12-months,12):history.slice(24-months*2,24-months);
 const selected=sumRows(selectedRows),reference=sumRows(comparisonRows),reconciliation=reconcileCash(selected);
 return {sample:true as const,months,comparison,comparisonLabel:comparison==='last-year'?'Same period last year':'Previous equivalent period',basis:'Accrual operating profit after depreciation and amortisation; operating cash before corporation tax and interest',asOf:'2026-10-11T23:59:59Z',closedThrough:'2026-09-30',currentBankCash:18_600_000,accounts:[{name:'Main trading bank',amount:16_400_000},{name:'Reserve bank',amount:2_200_000}],unsettledFunds:820_000,selected,reference,reconciliation,bridge:reconciliation.bridge,bankBridge:reconciliation.bankBridge,history:selectedRows.map((row,index)=>({...row,comparisonSales:comparisonRows[index].sales,comparisonProfit:comparisonRows[index].operatingProfit,comparisonCash:comparisonRows[index].operatingCash,comparisonClosingCash:comparisonRows[index].closingCash})),limitations:['Synthetic demonstration; no connected cash reporting or bank reconciliation is represented.','October is incomplete and excluded from monthly performance. Current bank cash is separately dated 11 October.','Stock is a change in inventory, not cash paid to suppliers. Supplier-credit effects appear separately.','Internal transfers between included accounts are excluded; unsettled processor funds are outside bank cash.'],drivers:[{label:'Cash tied up in stock',amount:selected.adjustments.stock,explanation:'Illustrative inventory increased; the separate payable movement allows for supplier credit.'},{label:'Supplier credit movement',amount:selected.adjustments.payables,explanation:'Illustrative trade-payable changes offset or add to the stock cash requirement.'},{label:'Non-cash depreciation',amount:selected.adjustments.nonCash,explanation:'Depreciation reduces operating profit without being a cash payment.'}]};
}
