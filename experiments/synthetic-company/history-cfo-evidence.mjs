/** Trusted history transaction adapter. No SQL, model, network or commercial actions.
 * Caller must finish membership, selection, seal and revision checks first.
 * Raw canonical records stay server-side; no expense is invented from a subtotal. */
import {createEvidenceContext,evaluateClaim,POLICY_VERSION} from '../../lib/cfo-engine/index.mjs';
import {calculateProfitEvidence,PROFIT_EVIDENCE_VERSION} from '../financial-v1/profit-evidence.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {historyToday} from './history-context.mjs';
const variable=new Set(['storage','returns','pickPack','carrier','packaging','processor']);
const keys=['netProductSales','netShipping','grossProfit','contribution','operatingProfit','ebitda'];
const ensure=value=>{if(!value)throw Error('CFO evidence unavailable');};
const sameScope=(a,b)=>['storeId','currency','from','to'].every(k=>a?.[k]===b[k]);
const hashRow=r=>{ensure(r&&digest(r.body)===r.row_hash);return r.body;};

export function historyProfitInput(report,scope,financialVersionId){
 ensure(scope.storeId===identity.storeId&&scope.currency===identity.currency);
 ensure(report.salesRevision===digest(report.salesManifest)&&report.costRevision===digest(report.costManifest));
 ensure(sameScope(report.salesManifest.scope,scope)&&sameScope(report.costManifest.scope,scope));
 ensure(digest(report.selectedLines)===digest(report.costManifest.lines)&&digest(report.costEvents)===digest(report.costManifest.expenseEvents));
 const common=(row)=>({storeId:scope.storeId,currency:scope.currency,basis:'actual',evidenceRef:`history-source:${row.source_id}`,sourceRevision:row.row_hash,observedRevision:row.row_hash});
 const lines=report.selectedLines.map(row=>{const b=hashRow(row);ensure(b.id===row.source_id&&b.store_id===scope.storeId&&b.sale_date===row.event_date);return {...common(row),id:b.id,orderId:b.order_id,soldOn:b.sale_date,quantity:b.quantity,unitCostPence:b.historic_unit_cost_pence,originalEligible:true,landedCostSupported:true};});
 // Cumulative recoveries are needed to reject repeated recovery of an original unit.
 const recoveries=report.costManifest.returns.map(row=>{const b=hashRow(row);ensure(b.source_return_id===row.source_id&&b.store_id===scope.storeId&&b.saleable_date===row.event_date);return {...common(row),id:row.source_id,lineId:b.line_id,recoveryOn:b.saleable_date,quantity:b.quantity,status:'saleable'};});
 const expenses=[];
 for(const row of report.costEvents){const b=hashRow(row);ensure(b.id===row.source_id&&b.date===row.event_date&&b.date>=scope.from&&b.date<=scope.to&&b.currency===scope.currency&&b.timezone===identity.timezone);ensure(b.postings.every(p=>Number.isSafeInteger(p.amount))&&b.postings.reduce((sum,p)=>sum+p.amount,0)===0);
  b.postings.forEach((p,index)=>{if(!p.account.startsWith('expense:'))return;const name=p.account.slice(8),category=variable.has(name)?'variableCosts':name==='marketing'?'advertising':'overheads';
   // Exact journal posting amount, never abs/net/allocated or reconstructed from totals.
   ensure(Number.isSafeInteger(p.amount)&&p.amount>=0);
   const id=`${row.source_id}:posting:${index}`;
   expenses.push({...common(row),id,sourceId:id,category,from:scope.from,to:scope.to,amountPence:p.amount,daPence:name==='depreciation'?p.amount:0});
  });
 }
 const coverage={};
 for(const [name,rows] of Object.entries({productCosts:lines,recoveries,variableCosts:expenses.filter(e=>e.category==='variableCosts'),advertising:expenses.filter(e=>e.category==='advertising'),overheads:expenses.filter(e=>e.category==='overheads'),da:expenses.filter(e=>e.category==='overheads')}))coverage[name]={...scope,complete:true,snapshotId:financialVersionId,revision:report.costRevision,evidenceRef:`history-v2:${financialVersionId}`,sourceIds:rows.map(r=>r.id)};
 return {version:PROFIT_EVIDENCE_VERSION,scope:{...scope},snapshotId:financialVersionId,sales:{snapshotId:financialVersionId,value:report.sales},costEvidence:{snapshotId:financialVersionId,revision:report.costRevision,lines,recoveries,expenses,coverage}};
}

export function createHistoryCfoBriefing({report,scope,financialVersionId,observedAt,now=new Date()}){
 const wire={contract:'history-cfo-briefing-v1',scope:{...scope,timezone:identity.timezone},sourceBasis:'synthetic-local',financialVersionId,salesRevision:report.salesRevision,costRevision:report.costRevision,observedAt,engineFormulaVersion:PROFIT_EVIDENCE_VERSION,policyVersion:POLICY_VERSION.version,status:'unavailable',facts:[],investigation:null};
 try{
  ensure(typeof financialVersionId==='string'&&/^[0-9a-f-]{36}$/.test(financialVersionId));
  ensure(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt))&&Date.parse(observedAt)<=+now);
  const profitInput=historyProfitInput(report,scope,financialVersionId),calculated=calculateProfitEvidence(profitInput);
  ensure(calculated.state==='complete');
  for(const [key,value] of Object.entries({cogs:report.components.cogs,variableCosts:report.components.variableCosts,advertising:report.components.advertising,overheads:report.components.overheadIncludingDA,da:report.components.depreciationAmortisation}))ensure(calculated[key].value===value);
  const value=key=>key==='netProductSales'||key==='netShipping'?calculated.sales[key]:calculated[key].value;
  for(const key of keys)ensure(Number.isSafeInteger(value(key))&&value(key)===(key==='netProductSales'||key==='netShipping'?report.sales[key]:report.profit[key]));
  const selected={companyId:identity.externalId,...scope,timeZone:identity.timezone,selectionVersion:financialVersionId};
  const sourceId='current-history',ref=`history-v2:${financialVersionId}`;
  const input={schemaVersion:'cfo-evidence-v1',scope:{...selected},mode:'reviewed',freshness:'current',sources:[{id:sourceId,ref,scope:{...selected},from:scope.from,to:scope.to,reportVersion:financialVersionId,sourceVersion:report.costRevision,formulaVersion:PROFIT_EVIDENCE_VERSION,observedAt,dataThrough:scope.to,profitInput}],metrics:keys.map(key=>({id:`current-${key}`,key,unit:'pence',period:'current',value:value(key),sourceId})),testPlan:null};
  const context=createEvidenceContext(input,{...selected,asOf:historyToday(now),access:'allowed',formulaVersion:PROFIT_EVIDENCE_VERSION});
  ensure(context.status==='ready');
  const facts=keys.map(key=>{const result=evaluateClaim(context,{kind:'fact',metricId:`current-${key}`});ensure(result.status==='supported'&&result.claims.length===1);const claim=result.claims[0];return {key,value:claim.value,unit:claim.unit,evidenceRefs:claim.evidenceRefs,ruleIds:result.ruleIds};});
  const investigation=evaluateClaim(context,{kind:'investigation',topic:'profit-change',metricIds:['grossProfit','contribution','operatingProfit','ebitda'].map(k=>`current-${k}`)});
  ensure(investigation.status==='supported');
  return {...wire,status:'supported',facts,investigation:{text:investigation.text,ruleIds:investigation.ruleIds}};
 }catch{return wire;}
}
