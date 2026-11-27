import {validReportingDate} from '../reportingRange.ts';
const fields=['grossProductSales','discounts','netProductSales','netShipping','originalOrders','cogs','variableCosts','advertising','overheadIncludingDA','depreciationAmortisation'] as const;
const next=(s:string)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
const safeSum=(values:number[])=>{const n=values.reduce((s,v)=>s+BigInt(v),0n);return n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER)?Number(n):null;};
/** Derived display buckets, never authority or a substitute for the range guard. */
export function reportingFinancialBuckets(financial:any,view:'weekly'|'monthly',perOrder=false){
 const daily=financial?.range?.dailyFinancial;
 const from=financial?.selection?.period?.from,to=financial?.selection?.period?.to;
 if(!validReportingDate(from)||!validReportingDate(to)||!Array.isArray(daily)||!daily.length||daily.length>731)return null;
 let expected=from;
 for(const row of daily){if(row.date!==expected||!fields.every(k=>Number.isSafeInteger(row[k]))||row.originalOrders<0)return null;expected=next(expected);}
 if(daily.at(-1).date!==to)return null;
 const total=(key:typeof fields[number])=>safeSum(daily.map(r=>r[key]));
 if(total('netProductSales')!==financial.amounts.netProductSales||total('netShipping')!==financial.amounts.netShipping||total('originalOrders')!==financial.originalOrders)return null;
 const metric=(key:string)=>financial.input?.profit?.[key]?.value;
 for(const [key,source]of [['cogs','cogs'],['variableCosts','variableCosts'],['advertising','advertising'],['overheadIncludingDA','overheads'],['depreciationAmortisation','da']] as const)if(total(key)!==metric(source))return null;
 const groups=new Map<string,typeof daily>();
 for(const row of daily){const d=new Date(row.date+'T12:00:00Z');if(view==='weekly')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const key=view==='weekly'?d.toISOString().slice(0,10):row.date.slice(0,7);groups.set(key,[...(groups.get(key)??[]),row]);}
 const result=[];
 for(const rows of groups.values()){
  const totals=Object.fromEntries(fields.map(k=>[k,safeSum(rows.map(r=>r[k]))]));if(Object.values(totals).some(n=>n===null))return null;
  const n=totals as Record<typeof fields[number],number>,revenue=safeSum([n.netProductSales,n.netShipping]);
  if(revenue===null)return null;
  const ebitda=safeSum([revenue,-n.cogs,-n.variableCosts,-n.advertising,-n.overheadIncludingDA,n.depreciationAmortisation]);if(ebitda===null)return null;
  const amount=(v:number)=>perOrder?(n.originalOrders>0?v/n.originalOrders:null):v;
  result.push({from:rows[0].date,to:rows.at(-1).date,label:rows[0].date,orders:n.originalOrders,originalProductSales:safeSum([n.grossProductSales,-n.discounts]),beforeAds:safeSum([revenue,-n.cogs,-n.variableCosts]),advertising:n.advertising,sales:amount(n.netProductSales),revenue:amount(revenue),ebitda:amount(ebitda),operatingProfit:(()=>{const value=safeSum([ebitda,-n.depreciationAmortisation]);return value===null?null:amount(value);})(),margin:revenue>0?ebitda/revenue:null});
 }
 return result;
}
