import type {composeHistoryMonth} from './v11/history-composition';
import type {HistoryAvailability,HistorySelection} from './v11/history-supported';
import {resolveHistoryMonthVersion} from './reportingMonth.ts';
type Month=NonNullable<ReturnType<typeof composeHistoryMonth>>;
const labels={netProductSales:'Net product sales',netShipping:'Net shipping revenue',cogs:'Cost of goods sold',variableCosts:'Variable operating costs',advertising:'Advertising',overheads:'Operating overheads (including depreciation and amortisation)',da:'Depreciation and amortisation',grossProfit:'Gross profit',contributionBeforeMarketing:'Contribution before advertising',contribution:'Contribution after advertising',operatingProfit:'Operating profit',ebitda:'EBITDA'} as const;
type Key=keyof typeof labels;
const signs={netProductSales:1,netShipping:1,cogs:-1,variableCosts:-1,advertising:-1,overheads:-1} as const;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string):v is Record<string,unknown>=>record(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const list=(v:unknown,w:string[])=>Array.isArray(v)&&v.length===w.length&&v.every((x,i)=>x===w[i]);
const text=(v:unknown)=>typeof v==='string'&&v.length<=5000;
export function immediatelyPriorSelection(current:Month,months:HistoryAvailability['months']):HistorySelection|null{
 const day=new Date(current.selection.period.from+'T12:00:00Z');day.setUTCDate(0);
 const to=day.toISOString().slice(0,10),from=to.slice(0,8)+'01';
 const row=months.find(m=>m.from===from&&m.to===to),version=resolveHistoryMonthVersion(row);
 return row&&version.versionId?{...current.selection,period:{from,to},versionId:version.versionId}:null;
}
function value(m:Month,key:Key):number|null{
 if(key in m.amounts)return m.amounts[key as keyof typeof m.amounts];
 const metric=m.input.profit?.[key as 'cogs'|'variableCosts'|'advertising'|'overheads'|'da'|'contributionBeforeMarketing'];
 return metric?.state==='ready'?metric.value:null;
}
function binding(raw:unknown,m:Month){return exact(raw,'financialVersionId,salesRevision,costRevision,observedAt,from,to')&&raw.financialVersionId===m.selection.versionId&&raw.salesRevision===m.evidence.salesRevision&&raw.costRevision===m.evidence.costRevision&&raw.observedAt===m.evidence.observedAt&&raw.from===m.selection.period.from&&raw.to===m.selection.period.to;}
export interface CheckedAnalysis {current:Month;prior:Month;facts:{key:Key;label:string;currentPence:number;priorPence:number;changePence:number}[];bridge:{key:Key;label:string;currentPence:number;priorPence:number;changePence:number;profitEffectPence:number}[];focus:Key|null;}
/** Display boundary: every number is reconciled against TWO independently accepted
 * canonical months. Server narrative is deliberately not rendered. */
export function reviewedCfoAnalysis(raw:unknown,current:Month,prior:Month):CheckedAnalysis|null{
 const s=current.selection,p=prior.selection;
 if(s.storeId!=='d7500000-0000-4000-8000-000000000009'||s.currency!=='GBP'||s.timezone!=='Europe/London'||current.input.access!=='allowed'||prior.input.access!=='allowed'||current.input.freshness!=='current'||prior.input.freshness!=='current'||p.storeId!==s.storeId||p.currency!==s.currency||p.timezone!==s.timezone||p.edition!==s.edition||p.anchor!==s.anchor)return null;
 const next=new Date(p.period.to+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);if(next.toISOString().slice(0,10)!==s.period.from)return null;
 if(!exact(raw,'contract,scope,sourceBasis,current,prior,analysis')||raw.contract!=='history-cfo-analysis-response-v1'||raw.sourceBasis!=='synthetic-local'||!binding(raw.current,current)||!binding(raw.prior,prior))return null;
 if(!exact(raw.scope,'storeId,currency,from,to,timezone')||raw.scope.storeId!==s.storeId||raw.scope.currency!==s.currency||raw.scope.timezone!==s.timezone||raw.scope.from!==s.period.from||raw.scope.to!==s.period.to)return null;
 const a=raw.analysis;if(!exact(a,'schemaVersion,status,mode,scope,policyVersion,formulaVersion,headline,explanation,facts,bridge,sources,investigation,limitation,reason,canExecute')||a.schemaVersion!=='cfo-analysis-v1'||a.status!=='ready'||a.mode!=='reviewed'||a.policyVersion!=='cfo-guardrails-core-v1'||a.formulaVersion!=='profit-evidence-v1'||a.canExecute!==false||a.reason!==null||![a.headline,a.explanation,a.limitation].every(text))return null;
 if(!exact(a.scope,'companyId,storeId,currency,timeZone,from,to,selectionVersion')||a.scope.companyId!=='fictional-uk-gifts-v2'||a.scope.storeId!==s.storeId||a.scope.currency!==s.currency||a.scope.timeZone!==s.timezone||a.scope.from!==s.period.from||a.scope.to!==s.period.to||a.scope.selectionVersion!==s.versionId)return null;
 const refs=[`history-v2:${s.versionId}`,`history-v2:${p.versionId}`],keys=Object.keys(labels) as Key[];
 if(!Array.isArray(a.facts)||a.facts.length!==keys.length||!Array.isArray(a.bridge)||a.bridge.length!==6||!Array.isArray(a.sources)||a.sources.length!==2)return null;
 const facts:CheckedAnalysis['facts']=[];
 for(const key of keys){const found=a.facts.filter(f=>record(f)&&f.key===key);if(found.length!==1)return null;const f=found[0],c=value(current,key),b=value(prior,key);
  if(!Number.isSafeInteger(c)||!Number.isSafeInteger(b)||!exact(f,'key,label,currentPence,priorPence,changePence,currentMetricId,priorMetricId,evidenceRefs')||f.label!==labels[key]||f.currentPence!==c||f.priorPence!==b||!Number.isSafeInteger(f.changePence)||f.changePence!==c!-b!||f.currentMetricId!==`current-${key}`||f.priorMetricId!==`prior-${key}`||!list(f.evidenceRefs,refs))return null;
  facts.push({key,label:labels[key],currentPence:c!,priorPence:b!,changePence:f.changePence as number});
 }
 const bridge:CheckedAnalysis['bridge']=[];
 for(const [index,key] of (Object.keys(signs) as (keyof typeof signs)[]).entries()){const b=a.bridge[index],f=facts.find(f=>f.key===key)!;
  if(!exact(b,'key,label,currentPence,priorPence,changePence,currentMetricId,priorMetricId,evidenceRefs,profitEffectPence')||b.key!==key||b.label!==f.label||b.currentPence!==f.currentPence||b.priorPence!==f.priorPence||b.changePence!==f.changePence||b.profitEffectPence!==signs[key]*f.changePence||!Number.isSafeInteger(b.profitEffectPence)||b.currentMetricId!==`current-${key}`||b.priorMetricId!==`prior-${key}`||!list(b.evidenceRefs,refs))return null;
  bridge.push({...f,profitEffectPence:b.profitEffectPence as number});
 }
 const profit=facts.find(f=>f.key==='operatingProfit')!;
 if(bridge.reduce((n,b)=>n+BigInt(b.profitEffectPence),0n)!==BigInt(profit.changePence))return null;
 for(const [index,m] of [current,prior].entries()){const src=a.sources[index],period=index?'prior':'current';
  if(!exact(src,'id,ref,from,to,reportVersion,sourceVersion,formulaVersion,observedAt,dataThrough')||src.id!==period+'-history'||src.ref!==refs[index]||src.from!==m.selection.period.from||src.to!==m.selection.period.to||src.reportVersion!==m.selection.versionId||src.sourceVersion!==m.evidence.costRevision||src.formulaVersion!=='profit-evidence-v1'||src.observedAt!==m.evidence.observedAt||src.dataThrough!==m.selection.period.to)return null;
 }
 const focus=bridge.reduce<CheckedAnalysis['bridge'][number]|null>((best,b)=>Math.abs(b.profitEffectPence)>Math.abs(best?.profitEffectPence??0)?b:best,null);
 if(focus?(!exact(a.investigation,'id,text,evidenceRefs')||a.investigation.id!=='review-profit-components'||!text(a.investigation.text)||!list(a.investigation.evidenceRefs,refs)):a.investigation!==null)return null;
 return {current,prior,facts,bridge,focus:focus?.key??null};
}
