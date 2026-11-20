/** Prepared cash reader contract. No endpoint currently supplies this evidence. Never accepts P&L as bank cash. */
export type CashScope={storeId:string;currency:'GBP';timezone:'Europe/London';from:string;to:string};
export type EligibleCashEvidence={
 contract:'eligible-cash-v1';storeId:string;currency:'GBP';timezone:'Europe/London';from:string;to:string;
 state:'reviewed';sourceRevision:string;mappingVersion:string;observedAt:string;invalidated:false;
 coverage:{accountsComplete:true;workingCapitalComplete:true;bankMovementsComplete:true;internalTransfersExcluded:true};
 accounts:{id:string;included:true;unrestricted:true;openingDate:string;closingDate:string;opening:number;closing:number}[];
 ebitda:number;workingCapital:{stock:number;debtors:number;providerSettlements:number;supplierCredit:number;other:number};
 operatingCash:number;bankMovements:{taxAndInterest:number;investing:number;financing:number;other:number};
 unsettledProviderFunds:number;
};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const pence=(v:unknown):v is number=>Number.isSafeInteger(v);
const isoDate=(s:unknown)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const exactSum=(values:number[])=>{const n=values.reduce((s,v)=>s+BigInt(v),0n);return n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER)?Number(n):null;};
export function eligibleCashView(raw:unknown,scope:CashScope,now=new Date()){
 if(!object(raw)||raw.contract!=='eligible-cash-v1'||raw.state!=='reviewed'||raw.invalidated!==false||!scope.storeId||scope.currency!=='GBP'||scope.timezone!=='Europe/London'||!isoDate(scope.from)||!isoDate(scope.to)||scope.from>scope.to)return null;
 for(const [key,value] of Object.entries(scope))if(raw[key]!==value)return null;
 if(![raw.sourceRevision,raw.mappingVersion].every(v=>typeof v==='string'&&v.trim().length>0)||typeof raw.observedAt!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(raw.observedAt)||!Number.isFinite(Date.parse(raw.observedAt))||Date.parse(raw.observedAt)>now.getTime()||Date.parse(raw.observedAt)<Date.parse(scope.to+'T00:00:00Z'))return null;
 if(!object(raw.coverage)||!['accountsComplete','workingCapitalComplete','bankMovementsComplete','internalTransfersExcluded'].every(k=>raw.coverage[k]===true)||!Array.isArray(raw.accounts)||!raw.accounts.length)return null;
 const ids=new Set<string>();
 for(const a of raw.accounts){if(!object(a)||typeof a.id!=='string'||!a.id||ids.has(a.id)||a.included!==true||a.unrestricted!==true||a.openingDate!==scope.from||a.closingDate!==scope.to||!pence(a.opening)||!pence(a.closing))return null;ids.add(a.id);}
 if(!object(raw.workingCapital)||!object(raw.bankMovements))return null;
 const wc=['stock','debtors','providerSettlements','supplierCredit','other'].map(k=>raw.workingCapital[k]);
 const movements=['taxAndInterest','investing','financing','other'].map(k=>raw.bankMovements[k]);
 if(![raw.ebitda,raw.operatingCash,raw.unsettledProviderFunds,...wc,...movements].every(pence)||raw.unsettledProviderFunds<0)return null;
 const opening=exactSum(raw.accounts.map(a=>a.opening)),closing=exactSum(raw.accounts.map(a=>a.closing));
 if(opening===null||closing===null||exactSum([raw.ebitda,...wc])!==raw.operatingCash||exactSum([opening,raw.operatingCash,...movements])!==closing)return null;
 const bankMovement=exactSum([raw.operatingCash,...movements]),cashLessProfit=exactSum([raw.operatingCash,-raw.ebitda]);
 if(bankMovement===null||cashLessProfit===null)return null;
 return {scope:{...scope},openingBankCash:opening,closingBankCash:closing,operatingCash:raw.operatingCash as number,
  bankMovement,unsettledProviderFunds:raw.unsettledProviderFunds as number,
  cashLessProfit,sourceRevision:raw.sourceRevision as string,mappingVersion:raw.mappingVersion as string,observedAt:raw.observedAt as string};
}
/** Complete reviewed monthly profit only. No allocated daily/weekly cash or substitute cash series. */
export function cashProfitHistory(months:readonly {selection:{storeId:string;currency:string;timezone:string;period:{from:string;to:string}};amounts:{ebitda:number|null}}[],storeId:string){
 if(months.length<2||!storeId)return null;
 for(let i=0;i<months.length;i++){
  const {selection:s,amounts}=months[i];
  if(s.storeId!==storeId||s.currency!=='GBP'||s.timezone!=='Europe/London'||!isoDate(s.period.from)||!isoDate(s.period.to)||!s.period.from.endsWith('-01')||!pence(amounts.ebitda))return null;
  const next=new Date(s.period.from+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const end=new Date(next);end.setUTCDate(end.getUTCDate()-1);
  if(end.toISOString().slice(0,10)!==s.period.to||(i&&months[i-1].selection.period.to!==new Date(Date.parse(s.period.from+'T00:00:00Z')-86400000).toISOString().slice(0,10)))return null;
 }
 return months.map(m=>({from:m.selection.period.from,to:m.selection.period.to,label:m.selection.period.from.slice(0,7),ebitda:m.amounts.ebitda!}));
}
