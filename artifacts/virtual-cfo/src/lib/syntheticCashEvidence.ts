import {composeHistoryMonth} from './v11/history-composition.ts';
import type {HistorySelection} from './v11/history-supported.ts';
import {eligibleCashView,type EligibleCashEvidence} from './cashSourceAdapter.ts';
type Movement={sourceId:string;date:string;amount:number};
type Balance={sourceId:string;date:string;amount:number};
type Account={id:string;included:true;unrestricted:true;opening:Balance;closing:Balance};
export type SyntheticCashInputs={
 sourceBasis:'synthetic-model';sourceRevision:string;mappingVersion:string;observedAt:string;
 accounts:Account[];
 workingCapital:Record<'stock'|'debtors'|'providerSettlements'|'supplierCredit'|'other',Movement[]>;
 bankMovements:Record<'taxAndInterest'|'investing'|'financing'|'other',Movement[]>;
 unsettledProviderFunds:Balance;
 coverage:EligibleCashEvidence['coverage'];
};
const wcKeys=['stock','debtors','providerSettlements','supplierCredit','other'] as const;
const bankKeys=['taxAndInterest','investing','financing','other'] as const;
const requireValue=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
const sum=(values:number[])=>{requireValue(values.every(Number.isSafeInteger),'Every movement requires recorded integer pence');const n=values.reduce((t,v)=>t+BigInt(v),0n);requireValue(n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER),'Cash amount exceeds supported precision');return Number(n);};
/** Offline preparation only: no cash defaults, inferred balances, source fetch, database rows or publication. */
export function prepareSyntheticCashEvidence(response:unknown,selection:HistorySelection,input:SyntheticCashInputs,now=new Date()){
 const month=composeHistoryMonth(response,selection);
 requireValue(month&&month.evidence.financialProfile==='uk-gifts-v2'&&month.evidence.costCoverage==='complete'&&Number.isSafeInteger(month.amounts.ebitda),'Complete reviewed monthly EBITDA required');
 requireValue(input?.sourceBasis==='synthetic-model','Explicit synthetic provenance required');
 requireValue(Array.isArray(input.accounts)&&input.accounts.length>0,'Explicit dated opening and closing cash required');
 const from=selection.period.from,to=selection.period.to;
 const date=new Date(from+'T00:00:00Z'),next=new Date(date);next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(next.getUTCDate()-1);
 requireValue(from.endsWith('-01')&&next.toISOString().slice(0,10)===to,'Complete calendar month required');
 const refs=new Set<string>();
 const record=(r:Balance,expectedDate?:string)=>{
  requireValue(r&&typeof r.sourceId==='string'&&r.sourceId.trim()&&!refs.has(r.sourceId),'Unique explicit source reference required for every cash record');
  requireValue(typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(Date.parse(r.date+'T00:00:00Z'))&&new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)===r.date&&r.date>=from&&r.date<=to&&(!expectedDate||r.date===expectedDate),'Cash record date must match the reviewed period');
  requireValue(Number.isSafeInteger(r.amount),'Recorded integer-pence cash amount required');refs.add(r.sourceId);
 };
 const accounts=input.accounts.map(a=>{requireValue(a&&a.included===true&&a.unrestricted===true,'Only explicitly included unrestricted accounts are eligible');record(a.opening,from);record(a.closing,to);return {id:a.id,included:a.included,unrestricted:a.unrestricted,openingDate:a.opening.date,closingDate:a.closing.date,opening:a.opening.amount,closing:a.closing.amount};});
 const movements=<K extends string>(source:Record<K,Movement[]>,keys:readonly K[])=>Object.fromEntries(keys.map(key=>{const rows=source?.[key];requireValue(Array.isArray(rows)&&rows.length>0,'Every cash category requires explicit evidence, including verified zero');rows.forEach(r=>record(r));return [key,sum(rows.map(r=>r.amount))];})) as Record<K,number>;
 const workingCapital=movements(input.workingCapital,wcKeys),bankMovements=movements(input.bankMovements,bankKeys);
 record(input.unsettledProviderFunds,to);requireValue(input.unsettledProviderFunds.amount>=0,'Pending provider funds cannot be negative');
 const evidence:EligibleCashEvidence={contract:'eligible-cash-v1',storeId:selection.storeId,currency:'GBP',timezone:'Europe/London',from,to,state:'reviewed',invalidated:false,
  sourceRevision:input.sourceRevision,mappingVersion:input.mappingVersion,observedAt:input.observedAt,coverage:structuredClone(input.coverage),accounts,
  ebitda:month!.amounts.ebitda!,workingCapital,operatingCash:sum([month!.amounts.ebitda!,...wcKeys.map(k=>workingCapital[k])]),bankMovements,unsettledProviderFunds:input.unsettledProviderFunds.amount};
 const view=eligibleCashView(evidence,{storeId:selection.storeId,currency:selection.currency,timezone:selection.timezone,from,to},now);
 requireValue(view,'Supplied balances and classified cash movements do not reconcile or lack eligible coverage');
 return {state:'prepared-only' as const,sourceBasis:'synthetic-model' as const,evidence,view:view!,provenance:{financialVersion:month!.evidence.versionId,salesRevision:month!.evidence.salesRevision,costRevision:month!.evidence.costRevision,
  financialObservedAt:month!.evidence.observedAt,cashRecords:structuredClone(input),sourceIds:[...refs]}};
}
