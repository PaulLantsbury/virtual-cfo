/** Offline review inputs from a separately captured read-only baseline. Not an API response collector or authority to publish. */
import {createHash} from 'node:crypto';
import {generate,summarise} from './generator.mjs';
import {HISTORY_EDITION,HISTORY_FORMULA,historySourceAsOf} from './history-context.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const ensure=(x,m)=>{if(!x)throw Error(m);};
const variable=['storage','returns','pickPack','carrier','packaging','processor'];
const integer=v=>{const n=typeof v==='string'&&/^-?\d{1,16}$/.test(v)?Number(v):v;ensure(Number.isSafeInteger(n),'Safe recorded source integer required');return n;};
const sum=xs=>{ensure(xs.every(Number.isSafeInteger),'Integer source totals required');const n=xs.reduce((a,b)=>a+BigInt(b),0n);ensure(n>=BigInt(Number.MIN_SAFE_INTEGER)&&n<=BigInt(Number.MAX_SAFE_INTEGER),'Unsafe source sum');return Number(n);};
/** Current package supports an unchanged base edition. Corrections require a separately reviewed overlay baseline. */
export function prepareSupplementalFinancialInputs(fixture,baseline,monthlyTotals){
 const {fingerprint,...body}=fixture??{};
 ensure(createHash('sha256').update(JSON.stringify(body)).digest('hex')===fingerprint,'Source fixture content changed');
 ensure(fixture?.scope?.profile==='uk-gifts-v2'&&fixture.from==='2024-11-01'&&generate({from:fixture.from,asOf:fixture.asOf}).fingerprint===fixture.fingerprint,'Exact source programme required');
 ensure(Array.isArray(baseline?.months)&&baseline.months.length>=1&&baseline.months.length<=24&&Array.isArray(baseline.overlays)&&baseline.overlays.length===0,'Base selected-source baseline required; review corrections separately');
 ensure(Array.isArray(monthlyTotals)&&monthlyTotals.length===baseline.months.length,'Exact monthly source-total coverage required');
 const seen=new Set();
 return baseline.months.map((b,i)=>{
  const a=monthlyTotals[i],m=b.metadata,scope={storeId:b.storeId,currency:'GBP',from:b.from,to:b.to};
  ensure(!seen.has(b.from)&&a?.month_from===b.from&&b.storeId===identity.storeId&&b.to<=fixture.to&&m?.edition===HISTORY_EDITION&&m.sourceBasis==='synthetic-local'&&m.timezone==='Europe/London'&&m.profile==='uk-gifts-v2'&&m.anchor===fixture.from&&m.formulaVersion===HISTORY_FORMULA&&m.scope?.storeId===b.storeId&&m.scope?.from===b.from&&m.scope?.to===b.to&&m.scope?.currency==='GBP'&&m.salesRevision===b.salesRevision&&m.costRevision===b.costRevision&&m.sourceAsOf===historySourceAsOf(b.to),'Financial baseline scope or source headers changed');seen.add(b.from);
  const t=summarise(fixture,b.from,b.to),p=a.balances;
  ensure(p&&Object.values(p).every(Number.isSafeInteger),'Recorded source account totals required');
  const expense=Object.entries(p).filter(([k])=>k.startsWith('expense:'));
  const components={cogs:p.cogs??0,variableCosts:sum(variable.map(k=>p['expense:'+k]??0)),advertising:p['expense:marketing']??0,overheadIncludingDA:sum(expense.filter(([k])=>k!=='expense:marketing'&&!variable.includes(k.slice(8))).map(([,v])=>v)),depreciationAmortisation:p['expense:depreciation']??0};
  // Zero defaults above are justified by complete canonical monthly account coverage,
  // never by missing coverage or a missing monthly record.
  const actual={orders:a.orders,gross:integer(a.gross),discounts:integer(a.discounts),netProduct:-(p.product_revenue??0),shipping:-(p.shipping_revenue??0),cogs:components.cogs,variableCosts:components.variableCosts,marketing:components.advertising,overheads:components.overheadIncludingDA,da:components.depreciationAmortisation};
  ensure(Object.entries(actual).every(([key,value])=>Number.isSafeInteger(value)&&value===t[key])&&a.orders===m.counts?.orders,'Read-only financial source totals differ from the exact synthetic programme');
  const sales={grossProductSales:t.gross,discounts:t.discounts,netProductSales:t.netProduct,netShipping:t.shipping,originalOrders:t.orders,aov:{value:t.orders>0?(t.gross-t.discounts)/t.orders:null,reason:t.orders>0?null:'No original orders'},provenance:scope};
  return {state:'supported',contract:'history-v2-proposal',versionId:b.versionId,snapshotId:b.versionId,scope,salesRevision:b.salesRevision,costRevision:b.costRevision,
   metadata:{edition:HISTORY_EDITION,versionId:b.versionId,anchor:m.anchor,formulaVersion:HISTORY_FORMULA,sourceBasis:'synthetic-local',verification:'canonical-source-revision-only',sourceAsOf:m.sourceAsOf,observedAt:m.observedAt},sales,components,
   profit:{state:'complete',grossProfit:t.grossProfit,contributionBeforeMarketing:t.contribution+t.marketing,contribution:t.contribution,ebitda:t.ebitda}};
 });
}
