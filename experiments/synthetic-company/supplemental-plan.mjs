/** Offline compiler only. No SQL, connections, files, credentials, provider calls or publication. */
import {createSyntheticCashSource,EXISTING_CAPITAL_ASSUMPTION} from './cash-source-model.mjs';
import {buildAcquisitionSource,summarizeAcquisitionSource} from './acquisition-source.mjs';
import {generate,date,addDays} from './generator.mjs';
import {prepareAcquisitionCosts,firstOrderEconomics,matureCohortEconomics,ACQUISITION_COST_POLICY,MATURE_SYNTHETIC_COHORT} from './acquisition-costs.mjs';
import {stableId,RESERVED_SYNTHETIC_IDENTITY} from './staging-payload.mjs';
import {supplementalDigest} from './supplemental-reader.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {historySourceAsOf,historyToday,HISTORY_EDITION} from './history-context.mjs';
import {composeHistoryMonth} from '../../artifacts/virtual-cfo/src/lib/v11/history-composition.ts';
import {cashSupplementView} from '../../artifacts/virtual-cfo/src/lib/cashSupplement.ts';
import {validateAcquisitionPayload} from '../../artifacts/virtual-cfo/src/lib/marketing/acquisition-evidence.ts';
const CONTRACT='synthetic-supplemental-plan-v1',store=RESERVED_SYNTHETIC_IDENTITY.storeId;
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const utc=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z');
function freeze(v){if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
/** Financial responses may contain a finite derived AOV; those private proofs are not persisted bodies. */
function proofJSON(value,seen=new Set(),depth=0){
 ensure(depth<=32,'Financial proof nesting exceeds review bound');
 if(value===null||typeof value==='boolean'||typeof value==='string')return;
 if(typeof value==='number'){ensure(Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER&&!Object.is(value,-0),'Invalid financial proof number');return;}
 ensure(value&&typeof value==='object'&&!seen.has(value),'Plain finite financial proof JSON required');seen.add(value);
 ensure(Array.isArray(value)?Object.getPrototypeOf(value)===Array.prototype:Object.getPrototypeOf(value)===Object.prototype,'Plain financial proof objects required');
 for(const key of Object.keys(value)){const d=Object.getOwnPropertyDescriptor(value,key);ensure(!['__proto__','constructor','prototype'].includes(key)&&d&&'value'in d,'Unsafe financial proof property');proofJSON(d.value,seen,depth+1);}
 ensure(Reflect.ownKeys(value).length===Object.keys(value).length+(Array.isArray(value)?1:0),'Hidden financial proof property');
 if(Array.isArray(value))ensure(Object.keys(value).length===value.length,'Sparse financial proof array');seen.delete(value);
}
function validateFinancial(report,observedAt,now){
 proofJSON(report);const r=structuredClone(report),scope=r?.scope,m=r?.metadata;
 ensure(r?.state==='supported'&&r.contract==='history-v2-proposal'&&uuid(r.versionId)&&r.snapshotId===r.versionId,'Exact supported monthly financial version required');
 ensure(scope&&Object.keys(scope).sort().join(',')==='currency,from,storeId,to'&&scope.storeId===store&&scope.currency==='GBP','Only the reserved synthetic reporting store is eligible');
 date(scope.from);date(scope.to);ensure(scope.from>='2024-11-01'&&scope.from.endsWith('-01')&&new Date(Date.UTC(+scope.from.slice(0,4),+scope.from.slice(5,7),0)).toISOString().slice(0,10)===scope.to,'Actual complete covered calendar month required');
 ensure(sha(r.salesRevision)&&sha(r.costRevision)&&m?.versionId===r.versionId&&m.edition===HISTORY_EDITION&&m.anchor==='2024-11-01'&&m.formulaVersion==='night-scout-v11-2026-10-30'&&m.sourceBasis==='synthetic-local'&&m.verification==='canonical-source-revision-only','Exact synthetic edition, formula and source revisions required');
 ensure(utc(m.observedAt)&&utc(m.sourceAsOf)&&Date.parse(m.sourceAsOf)===Date.parse(historySourceAsOf(scope.to))&&Date.parse(m.observedAt)>=Date.parse(m.sourceAsOf)&&Date.parse(m.observedAt)<=Date.parse(observedAt)&&Date.parse(observedAt)<=now.getTime(),'Financial source cutoff or observation differs');
 const selection={storeId:store,currency:'GBP',timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01',period:{from:scope.from,to:scope.to},versionId:r.versionId};
 const month=composeHistoryMonth(r,selection);
 ensure(month?.evidence.costCoverage==='complete'&&Number.isSafeInteger(month.amounts.ebitda)&&Object.values(month.amounts).every(Number.isSafeInteger),'Complete reconciled monthly financial components required');
 return {raw:r,selection,month};
}
/** Both kinds are mandatory by default. A caller must explicitly narrow kinds; there is no skip-on-failure path. */
export function compileSupplementalPlan({financialReports,cashFixture,acquisitionSource,observedAt,verifiedExpenseOverlays=[],...unknownInput}={}, {kinds=['cash','acquisition'],now=new Date(),includeEconomics=false,...unknownOptions}={}){
 ensure(Object.keys(unknownInput).length===0&&Object.keys(unknownOptions).length===0,'Only explicit compiler inputs/options accepted; caller cost proofs are forbidden');
 ensure(typeof includeEconomics==='boolean','Explicit boolean economics option required');
 ensure(utc(observedAt)&&Number.isFinite(now.getTime())&&Date.parse(observedAt)<=now.getTime(),'Truthful explicit UTC package observation required');
 ensure(Array.isArray(kinds)&&kinds.length>=1&&kinds.length<=2&&new Set(kinds).size===kinds.length&&kinds.every(k=>['cash','acquisition'].includes(k)),'Explicit unique supported supplemental kinds required');
 ensure(Array.isArray(financialReports)&&financialReports.length>=1&&financialReports.length<=24,'One to twenty-four reviewed months required');
 const reports=financialReports.map(r=>validateFinancial(r,observedAt,now));
 ensure(new Set(reports.map(r=>r.raw.versionId)).size===reports.length,'Unique financial evidence versions required across months');
 for(let i=1;i<reports.length;i++)ensure(addDays(reports[i-1].selection.period.to,1)===reports[i].selection.period.from,'Unique chronologically contiguous financial months required');
 ensure(!includeEconomics||kinds.includes('acquisition'),'Economics requires the acquisition kind');
 const orderedKinds=['cash','acquisition'].filter(k=>kinds.includes(k));
 const completedThrough=addDays(historyToday(new Date(observedAt)),-1);
 if(kinds.includes('cash')||includeEconomics)ensure(cashFixture?.to&&cashFixture.to<=completedThrough,'Cash source cannot include uncompleted observation-day or future activity');
 const cash=kinds.includes('cash')||includeEconomics?createSyntheticCashSource(cashFixture,{openingCapital:EXISTING_CAPITAL_ASSUMPTION,observedAt,verifiedExpenseOverlays}):null;
 if(kinds.includes('acquisition')){
  ensure(acquisitionSource?.from==='2024-01-01'&&typeof acquisitionSource.through==='string','Full acquisition history from January 2024 required');
  date(acquisitionSource.through);ensure(acquisitionSource.through<=completedThrough,'Acquisition source cannot include uncompleted observation-day or future activity');
  const canonical=buildAcquisitionSource(generate({from:'2024-01-01',asOf:addDays(acquisitionSource.through,1)}));
  ensure(canonical.sourceHash===acquisitionSource.sourceHash,'Acquisition source must match the immutable identity programme');
 }
 let acquisitionCosts=null;
 if(includeEconomics){
  const sensitive=new Set(['expense:storage','expense:returns','expense:pickPack','expense:carrier','expense:packaging','expense:processor','expense:marketing']);
  ensure(!verifiedExpenseOverlays.some(o=>o.afterBody?.postings?.some(p=>sensitive.has(p.account))),'Reviewed variable/marketing correction requires a separately supported economics source');
  acquisitionCosts=prepareAcquisitionCosts(cashFixture,acquisitionSource);
 }
 const maturePeriods=Array.from({length:6},(_,i)=>{const from=`2026-${String(i+4).padStart(2,'0')}-01`,to=new Date(Date.UTC(2026,i+4,0)).toISOString().slice(0,10);return {from,to};});
 const dependencies=maturePeriods.map(p=>reports.find(r=>r.raw.scope.from===p.from&&r.raw.scope.to===p.to)?.raw);
 const matureDependencies=dependencies.every(Boolean)?dependencies.map(r=>({from:r.scope.from,to:r.scope.to,versionId:r.versionId,salesRevision:r.salesRevision,costRevision:r.costRevision})):[];
 const matureEconomics=acquisitionCosts&&matureDependencies.length===6&&acquisitionSource.through>=MATURE_SYNTHETIC_COHORT.observedThrough?matureCohortEconomics(acquisitionCosts,acquisitionSource,MATURE_SYNTHETIC_COHORT):null;
 const records=[],cashProofs=[];
 for(const {raw:r,selection} of reports){
  const scope={...r.scope,timezone:'Europe/London'};
  const preparedCash=cash?cash.month({...r.scope,financialVersionId:r.versionId,reviewedEbitda:r.profit.ebitda,now}):null;
  if(acquisitionCosts){
   const rows=acquisitionCosts.contributionEntries.filter(e=>e.date>=scope.from&&e.date<=scope.to);
   const sum=key=>Number(rows.reduce((n,e)=>n+BigInt(e[key]),0n));
   ensure(sum('netProductSales')===r.sales.netProductSales&&sum('netShipping')===r.sales.netShipping&&sum('cogs')===r.components.cogs&&sum('variableCosts')===r.components.variableCosts,'Economics costs must reconcile with exact selected financial components');
  }
  for(const kind of orderedKinds){let payload;
   if(kind==='cash'){
    const prepared=preparedCash;
    const manifest=prepared.sourceManifest;
    const source=Object.fromEntries(['contract','sourceBasis','profile','anchor','from','to','sourceRevision','mappingVersion','sourcePrefixHash','bankLedgerHash'].map(k=>[k,manifest[k]]));
    source.overlayCommitments=manifest.verifiedExpenseOverlays.map(o=>({financialVersionId:o.financialVersionId,eventId:o.afterBody.id,date:o.afterBody.date,beforeHash:o.beforeHash,afterHash:o.afterHash}));
    payload={evidence:prepared.evidence,source};
    ensure(cashSupplementView(payload,r,now)!==null,'Cash presentation contract rejected the exact financial binding');
    cashProofs.push({scope,financialVersionId:r.versionId,sourceManifest:manifest,bankLedger:prepared.bankLedger,reconciliation:prepared.reconciliation});
   }else{
    payload=summarizeAcquisitionSource(acquisitionSource,{from:scope.from,to:scope.to,financial:r});
    if(acquisitionCosts){payload.economics={policy:ACQUISITION_COST_POLICY,
     first:firstOrderEconomics(acquisitionCosts,acquisitionSource,{from:scope.from,to:scope.to,observedThrough:scope.to}),
     mature:scope.to>=MATURE_SYNTHETIC_COHORT.observedThrough?matureEconomics:null,
     dependencies:matureEconomics&&scope.to>=MATURE_SYNTHETIC_COHORT.observedThrough?matureDependencies:[],
     source:{costSourceHash:acquisitionCosts.sourceHash,allocationHash:acquisitionCosts.allocationHash,repeatMarketingHash:acquisitionCosts.repeatMarketingHash}};
     payload.limitations=payload.limitations.map(text=>text==='First-order contribution and mature payback need a separately reviewed matched cost/cohort model.'?'Allocated synthetic costs apply to matched paid first orders; refunds are observed only through the selected period. The mature cohort has a separate, explicitly covered window; this is not bank-cash payback or a forecast.':text);
     payload.limitations.push('Customer contribution excludes overheads and VAT. Matched repeat marketing is deducted once before comparing mature cohort contribution with its paired acquisition spend.');
    }
    ensure(validateAcquisitionPayload(payload,r),'Acquisition presentation contract rejected the exact financial binding');
   }
   const body={contract:'reviewed-supplement-v1',kind,scope,financialVersionId:r.versionId,salesRevision:r.salesRevision,costRevision:r.costRevision,sourceBasis:'synthetic-local',observedAt,payload};
   const body_hash=supplementalDigest(body);
   const snapshot_id=stableId('supplemental-v1',`${kind}:${store}:${scope.from}:${scope.to}:${r.versionId}:${body_hash}`);
   records.push({snapshot_id,store_id:store,date_from:scope.from,date_to:scope.to,kind,financial_version:r.versionId,sales_revision:r.salesRevision,cost_revision:r.costRevision,body,body_hash,observed_at:observedAt,invalidated:false});
  }
 }
 const proofs={financialReports:reports.map(r=>r.raw),cash:cashProofs,acquisitionSource:kinds.includes('acquisition')?structuredClone(acquisitionSource):null,acquisitionCosts};
 const counters={months:reports.length,cash:records.filter(r=>r.kind==='cash').length,acquisition:records.filter(r=>r.kind==='acquisition').length,records:records.length,cashBankRows:cashProofs.reduce((n,p)=>n+p.bankLedger.length,0)};
 const hashes={financialReports:digest(proofs.financialReports),proofs:digest(proofs),records:digest(records)};
 const artifact={contract:CONTRACT,state:'prepared-only',storeId:store,from:reports[0].selection.period.from,to:reports.at(-1).selection.period.to,observedAt,kinds:orderedKinds,economicsIncluded:includeEconomics,counters,hashes,records,proofs,limitations:['Offline source compilation is not authority to publish, install, grant or activate.','Selected financial versions, correction lineage and source/cost revisions require authenticated current-state verification before publication.','Full manifests and raw synthetic bank/identity records are offline proofs, not public API payloads.']};
 return freeze({...artifact,planHash:digest(artifact)});
}
