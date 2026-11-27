/** Server-side adapter for two already authorised, sealed history reports.
 * This is not an authentication boundary. The history reader must verify membership,
 * exact selection, revision, completeness and freshness for BOTH months first.
 * No database/network access or source mutations; raw rows never leave this adapter.
 */
import {analyzeFinancialChange} from '../../lib/cfo-analysis/index.mjs';
import {historyProfitInput} from './history-cfo-evidence.mjs';
import {calculateProfitEvidence,PROFIT_EVIDENCE_VERSION} from '../financial-v1/profit-evidence.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {historyToday} from './history-context.mjs';

const keys=['netProductSales','netShipping','cogs','variableCosts','advertising','overheads','da','grossProfit','contributionBeforeMarketing','contribution','operatingProfit','ebitda'];
const ensure=value=>{if(!value)throw Error('History comparison evidence unavailable');};
const scopeFields=['storeId','currency','from','to'];
function snapshot(record,period,selection,now){
 const {report,scope,financialVersionId,observedAt}=record;
 ensure(scope.storeId===identity.storeId&&scope.currency===identity.currency);
 ensure(typeof financialVersionId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(financialVersionId));
 ensure(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt))&&Date.parse(observedAt)<=+now);
 const profitInput=historyProfitInput(report,scope,financialVersionId);
 const calculated=calculateProfitEvidence(profitInput);
 ensure(calculated.state==='complete');
 const expected={netProductSales:report.sales.netProductSales,netShipping:report.sales.netShipping,
  cogs:report.components.cogs,variableCosts:report.components.variableCosts,advertising:report.components.advertising,
  overheads:report.components.overheadIncludingDA,da:report.components.depreciationAmortisation,
  grossProfit:report.profit.grossProfit,contributionBeforeMarketing:report.profit.contributionBeforeMarketing,
  contribution:report.profit.contribution,operatingProfit:report.profit.operatingProfit,ebitda:report.profit.ebitda};
 const value=key=>key==='netProductSales'||key==='netShipping'?calculated.sales[key]:calculated[key].value;
 for(const key of keys)ensure(Number.isSafeInteger(value(key))&&value(key)===expected[key]);
 const sourceId=`${period}-history`;
 return {source:{id:sourceId,ref:`history-v2:${financialVersionId}`,scope:{...selection,...Object.fromEntries(scopeFields.map(key=>[key,scope[key]]))},
  from:scope.from,to:scope.to,reportVersion:financialVersionId,sourceVersion:report.costRevision,
  formulaVersion:PROFIT_EVIDENCE_VERSION,observedAt,dataThrough:scope.to,profitInput},
  metrics:keys.map(key=>({id:`${period}-${key}`,key,unit:'pence',period,value:value(key),sourceId}))};
}

/** Server-only raw evidence seam for the bounded model adapter. NEVER serialize this
 * packet to the browser or send it to a model. The model adapter builds its own
 * aggregate-only allowlist from the reconciled result. access and freshness are
 * explicit trusted-reader assertions, never browser input.
 */
export function prepareHistoryCfoAnalysis({current,prior=null,now=new Date(),access,freshness}={}){
 let expected={companyId:'',storeId:'',currency:'',timeZone:'',selectionVersion:'',from:'',to:'',asOf:'',access:'denied',formulaVersion:PROFIT_EVIDENCE_VERSION};
 try{
  const scope=current.scope;
  const selection={companyId:identity.externalId,...Object.fromEntries(scopeFields.map(key=>[key,scope[key]])),timeZone:identity.timezone,selectionVersion:current.financialVersionId};
  expected={...selection,asOf:historyToday(now),access,formulaVersion:PROFIT_EVIDENCE_VERSION};
  if(access!=='allowed'||!['current','stale'].includes(freshness))return {input:null,expected};
  const selected=snapshot(current,'current',selection,now),sources=[selected.source],metrics=[...selected.metrics];
  // A bad prior month cannot suppress separately valid current-month facts.
  if(prior){try{const previous=snapshot(prior,'prior',selection,now);sources.push(previous.source);metrics.push(...previous.metrics);}catch{/* Comparison remains withheld. */}}
  return {input:{schemaVersion:'cfo-evidence-v1',scope:selection,mode:'reviewed',freshness,sources,metrics,testPlan:null},expected};
 }catch{return {input:null,expected};}
}

/** Only this bounded result is suitable for a presentation boundary. */
export function createHistoryCfoAnalysis(request){
 const {input,expected}=prepareHistoryCfoAnalysis(request);
 return analyzeFinancialChange(input,expected);
}
