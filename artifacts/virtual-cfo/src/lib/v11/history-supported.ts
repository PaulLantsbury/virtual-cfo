import type { ReportingAdapterInput, SupportedProfitMetric, SupportedProfitReport } from './reporting-adapter.ts';
import { FORMULA_VERSION } from './fixtures.ts';
import { validRange } from './periods.ts';
export const HISTORY_EDITION = 'synthetic-history-v2-2026-11';
export interface HistorySelection {
 storeId: string; currency: 'GBP'; timezone: 'Europe/London'; edition: typeof HISTORY_EDITION; anchor: string;
 period: {from:string;to:string};
 versionId:string;
}
export interface HistoryAvailability {
 contract:'history-availability-v2';verification:'sealed-candidates-only';requiresReadValidation:true;storeId:string;currency:'GBP';timezone:'Europe/London';edition:typeof HISTORY_EDITION;anchor:string;
 /** Reviewed sealed candidates only. Selected read must validate actual sources before displaying any figures. */
 months: {from:string;to:string;snapshotId:string;versionId?:string;requiresExplicitSelection?:boolean;versions?:{versionId:string;status:'selected'|'invalidated';kind:'base'|'expense-correction'}[]}[];
}
const utc=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,19)===v.slice(0,19);
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v);
const month=(r:{from:string;to:string})=>validRange(r)&&r.from.endsWith('-01')&&r.to===new Date(Date.UTC(+r.from.slice(0,4),+r.from.slice(5,7),0)).toISOString().slice(0,10);
const metric=(v:unknown):SupportedProfitMetric=>({value:money(v)?v:null,state:money(v)?'ready':'unavailable',reason:money(v)?null:'History component evidence unavailable'});
/** New edition response only. Never treats v1 data, insertion time or sample fixtures as history evidence. */
export function historySupportedInput(raw:unknown, selection:HistorySelection):ReportingAdapterInput {
 const expected={storeId:selection.storeId,currency:selection.currency,timezone:selection.timezone,period:selection.period};
 const unavailable:ReportingAdapterInput={expected,sourceBasis:'synthetic-local',sales:null,profit:null,access:'allowed',freshness:'invalidated',snapshot:null};
 if(!raw||typeof raw!=='object'||selection.edition!==HISTORY_EDITION||!month(selection.period)||!validRange({from:selection.anchor,to:selection.period.from}))return unavailable;
 const r=raw as Record<string,any>,m=r.metadata,s=r.scope;
 if(!selection.versionId||r.versionId!==selection.versionId||r.state!=='supported'||r.contract!=='history-v2-proposal'||!s||s.storeId!==selection.storeId||s.currency!==selection.currency||s.from!==selection.period.from||s.to!==selection.period.to
 || r.snapshotId!==selection.versionId||!m||m.versionId!==selection.versionId||m.edition!==selection.edition||m.anchor!==selection.anchor||m.sourceBasis!=='synthetic-local'||m.formulaVersion!==FORMULA_VERSION||m.verification!=='canonical-source-revision-only'
 || !utc(m.sourceAsOf)||!utc(m.observedAt)||Date.parse(m.observedAt)<Date.parse(m.sourceAsOf)||typeof r.snapshotId!=='string'||!r.snapshotId
 || typeof r.salesRevision!=='string'||!r.salesRevision||typeof r.costRevision!=='string'||!r.costRevision)return unavailable;
 // Metadata describes the exclusive end of this exact London month, never the observation/fetch date.
 const next=new Date(`${selection.period.to}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
 const day=next.toISOString().slice(0,10);const londonHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'numeric',hourCycle:'h23'}).format(new Date(`${day}T00:00:00Z`)));
 const asOf=new Date(Date.parse(`${day}T00:00:00Z`)-londonHour*3600000).toISOString();
 if(Date.parse(m.sourceAsOf)!==Date.parse(asOf))return unavailable;
 const sales=r.sales;
 if(!sales||!sales.provenance||sales.provenance.storeId!==s.storeId||sales.provenance.currency!==s.currency||sales.provenance.from!==s.from||sales.provenance.to!==s.to)return unavailable;
 const supportedSales={...sales,provenance:{...sales.provenance,coverageEvidence:`history:${r.snapshotId}`}};
 const c=r.components,p=r.profit;
 let profit:SupportedProfitReport|null=null;
 if(c&&p?.state==='complete')profit={scope:s,state:'complete',reason:null,sales:supportedSales,cogs:metric(c.cogs),variableCosts:metric(c.variableCosts),advertising:metric(c.advertising),overheads:metric(c.overheadIncludingDA),da:metric(c.depreciationAmortisation),grossProfit:metric(p.grossProfit),contributionBeforeMarketing:metric(p.contributionBeforeMarketing),contribution:metric(p.contribution),ebitda:metric(p.ebitda)};
 return {expected,sourceBasis:'synthetic-local',sales:supportedSales,profit,access:'allowed',freshness:'current',snapshot:{id:r.snapshotId,asOf:m.sourceAsOf}};
}
/** Availability never silently selects a month or mixes opening editions. */
export function historyAvailableMonths(raw:unknown, scope:Omit<HistorySelection,'period'|'versionId'>):HistoryAvailability['months'] {
 if(!raw||typeof raw!=='object')return [];
 const r=raw as HistoryAvailability;
 if(r.verification!=='sealed-candidates-only'||r.requiresReadValidation!==true||r.contract!=='history-availability-v2'||r.storeId!==scope.storeId||r.edition!==scope.edition||r.anchor!==scope.anchor||r.currency!==scope.currency||r.timezone!==scope.timezone||!Array.isArray(r.months))return [];
 const seen=new Set<string>();
 for(const range of r.months){if(!range||!month(range)||range.from<scope.anchor||typeof range.snapshotId!=='string'||!range.snapshotId||seen.has(range.from))return [];seen.add(range.from);
 if(range.versions){const ids=new Set<string>();for(const version of range.versions){if(typeof version.versionId!=='string'||!version.versionId||ids.has(version.versionId)||!['selected','invalidated'].includes(version.status)||!['base','expense-correction'].includes(version.kind))return [];ids.add(version.versionId);}}
 }
 return [...r.months].sort((a,b)=>a.from.localeCompare(b.from));
}
