/** Historical cash-use indicator, deliberately not a forecast or shortfall date. Pence. */
export function cashResilience({currentCash,minimumBuffer,months}:{currentCash:number;minimumBuffer:number;months:{complete:boolean;operatingCash:number;tax:number;investment:number;otherBankMovements:number}[]}){
 if(!Number.isSafeInteger(currentCash)||!Number.isSafeInteger(minimumBuffer)||minimumBuffer<0)throw Error('Invalid cash or buffer');
 const aboveBuffer=currentCash-minimumBuffer;
 if(months.length!==3||months.some(m=>!m.complete||![m.operatingCash,m.tax,m.investment,m.otherBankMovements].every(Number.isSafeInteger)))return {state:'unavailable' as const,aboveBuffer,monthlyMovement:null,coverMonths:null};
 const total=months.reduce((s,m)=>s+m.operatingCash+m.tax+m.investment+m.otherBankMovements,0);
 if(!Number.isSafeInteger(total))return {state:'unavailable' as const,aboveBuffer,monthlyMovement:null,coverMonths:null};
 const monthlyMovement=total/3;
 return {state:monthlyMovement<0?'cash-used' as const:monthlyMovement>0?'cash-positive' as const:'flat' as const,aboveBuffer,monthlyMovement,coverMonths:monthlyMovement<0?Math.max(0,currentCash)/-monthlyMovement:null};
}
