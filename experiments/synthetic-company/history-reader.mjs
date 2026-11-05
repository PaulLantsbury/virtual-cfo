/** Proposed v2 SQL reader. Reuses canonical monetary engines, NOT installed finance_v1 SQL/seals. */
import {resolveHistorySelection} from './history-versions.mjs';
import {HISTORY_EDITION,HISTORY_FORMULA,historySourceAsOf,historyToday} from './history-context.mjs';
import {reviewerAuthenticator} from '../shopify/reviewer-auth.mjs';
import {calculateMappedSales} from '../financial-v1/cloud-sales-adapter.mjs';
import {profitBridge} from '../financial-v1/calculations.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {validProfitScope} from '../financial-v1/profit-reporting-service.mjs';
import {pence} from '../financial-v1/source-adapter.mjs';
import {stableId,RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const ensure=(x,m)=>{if(!x)throw Error(m);};
const variable=new Set(['storage','returns','pickPack','carrier','packaging','processor']);

const validRow=(r,scope,dateKey)=>{ensure(digest(r.body)===r.row_hash&&r.body.store_id===scope.storeId&&r.body.id===r.source_id&&r.body[dateKey]===r.event_date,'History mapped source scope/hash changed');};
export async function historySources(tx,scope,{overlays=new Map()}={}){
 const args=[scope.storeId,scope.from,scope.to];
 const orders=(await tx.query(`SELECT source_id,event_date::text,body,row_hash FROM finance_history_v2.orders WHERE store_id=$1 AND (event_date BETWEEN $2::date AND $3::date OR source_id IN(SELECT body->>'order_id' FROM finance_history_v2.refunds WHERE store_id=$1 AND event_date BETWEEN $2::date AND $3::date)) ORDER BY source_id`,args)).rows;
 const orderIds=orders.map(r=>r.source_id),currentIds=orders.filter(r=>r.event_date>=scope.from).map(r=>r.source_id);
 const refunds=(await tx.query(`SELECT source_id,event_date::text,body,row_hash FROM finance_history_v2.refunds WHERE store_id=$1 AND body->>'order_id'=ANY($2) AND event_date<=$3::date ORDER BY source_id`,[scope.storeId,orderIds,scope.to])).rows;
 const returns=(await tx.query(`SELECT source_id,event_date::text,body,row_hash FROM finance_history_v2.returns WHERE store_id=$1 AND event_date BETWEEN $2::date AND $3::date ORDER BY source_id`,args)).rows;
 const lineIds=returns.map(r=>r.body.line_id);
 const lines=(await tx.query(`SELECT source_id,event_date::text,body,row_hash FROM finance_history_v2.lines WHERE store_id=$1 AND (body->>'order_id'=ANY($2) OR source_id=ANY($3)) ORDER BY source_id`,[scope.storeId,orderIds,lineIds])).rows;
 const orderRefs=orders.map(r=>r.body.shopify_order_id.replace('synthetic:uk-gifts-v2:',''));
 const events=(await tx.query(`SELECT source_id,event_date::text,kind,order_ref,dependency_only,body,row_hash FROM finance_history_v2.events WHERE store_id=$1 AND (event_date BETWEEN $2::date AND $3::date OR (order_ref=ANY($4) AND kind IN('sale','refund') AND event_date<=$3::date)) ORDER BY source_id`,[...args,orderRefs])).rows;
 for(const r of events)ensure(digest(r.body)===r.row_hash,'Immutable base event changed');
 for(const [id,overlay]of overlays){const r=events.find(e=>e.source_id===id);ensure(r,'Correction event outside selected scope');r.body=overlay.body;r.row_hash=overlay.row_hash;}
 for(const r of events){const e=r.body;ensure(digest(e)===r.row_hash&&e.id===r.source_id&&e.date===r.event_date&&e.kind===r.kind&&(e.refs.orderId||null)===r.order_ref&&e.company==='fictional-uk-gifts'&&e.profile==='uk-gifts-v2'&&e.currency==='GBP'&&e.timezone==='Europe/London'&&e.provider===null&&e.provenance==='synthetic-local','History journal index/scope/hash mismatch');ensure(e.postings.every(p=>Number.isSafeInteger(p.amount))&&e.postings.reduce((s,p)=>s+p.amount,0)===0,'Unbalanced history journal');}
 const saleEvents=new Map(events.filter(r=>r.kind==='sale').map(r=>[stableId('order',r.body.refs.orderId),r.body]));
 const refundEvents=new Map(events.filter(r=>r.kind==='refund').map(r=>[stableId('refund',r.body.id),r.body]));
 for(const r of orders){validRow(r,scope,'event_date');const e=saleEvents.get(r.source_id),o=r.body;ensure(e&&o.shopify_order_id===`synthetic:uk-gifts-v2:${e.refs.orderId}`,'Actual original-sale provenance missing');for(const [field,key]of Object.entries({gross_sales:'gross',discounts:'discounts',net_sales:'productSales',shipping:'shipping',tax:'outputVat'}))ensure(pence(o[field])===e.metrics[key],'Order financial source changed');}
 for(const r of refunds){validRow(r,scope,'event_date');const e=refundEvents.get(r.source_id);ensure(e&&stableId('order',e.refs.orderId)===r.body.order_id&&e.date===r.event_date&&pence(r.body.product_cash)===e.metrics.refunds+e.metrics.refundedVat&&pence(r.body.product_vat)===e.metrics.refundedVat,'Refund source changed');}
 const orderMap=new Map(orders.map(r=>[r.source_id,r]));
 for(const r of lines){validRow(r,scope,'sale_date');const l=r.body,o=orderMap.get(l.order_id);ensure(o&&r.event_date===o.event_date&&l.quantity===1&&Number.isSafeInteger(l.historic_unit_cost_pence)&&l.historic_unit_cost_pence>=0,'Historical product-unit cost unsupported');}
 for(const o of orders){const all=lines.filter(l=>l.body.order_id===o.source_id);const expected=saleEvents.get(o.source_id);ensure(all.length>=1&&all.reduce((sum,l)=>sum+pence(l.body.total),0)===expected.metrics.productSales&&all.reduce((sum,l)=>sum+pence(l.body.discount),0)===expected.metrics.discounts&&all.reduce((sum,l)=>sum+l.body.quantity*l.body.historic_unit_cost_pence,0)===expected.metrics.cogs,'Original unit amounts/costs do not reconcile');}
 const lineMap=new Map(lines.map(r=>[r.source_id,r]));
 const priorReturns=(await tx.query(`SELECT source_id,event_date::text,body,row_hash FROM finance_history_v2.returns WHERE store_id=$1 AND body->>'line_id'=ANY($2) AND event_date<=$3::date ORDER BY source_id`,[scope.storeId,[...lineMap.keys()],scope.to])).rows;
 const quantities=new Map();for(const r of priorReturns){const b=r.body;ensure(digest(b)===r.row_hash&&b.source_return_id===r.source_id&&b.store_id===scope.storeId&&b.saleable_date===r.event_date&&b.quantity===1,'Stock recovery source hash/date unsupported');const l=lineMap.get(b.line_id);ensure(l&&r.event_date>=l.event_date,'Stock recovery original unit missing');const refund=refunds.find(f=>f.source_id===b.refund_id),ev=refundEvents.get(b.refund_id);ensure(refund&&ev&&refund.body.order_id===l.body.order_id&&r.event_date===refund.event_date&&b.quantity*l.body.historic_unit_cost_pence===-ev.metrics.cogs,'Recovery/refund source proof differs');quantities.set(b.line_id,(quantities.get(b.line_id)||0)+b.quantity);ensure(quantities.get(b.line_id)<=l.body.quantity,'Cumulative recovered stock exceeds original quantity');}
 const within=r=>r.event_date>=scope.from&&r.event_date<=scope.to;
 const selectedOrders=orders.filter(within),selectedRefunds=refunds.filter(within),selectedReturns=returns;
 const costEvents=events.filter(r=>within(r)&&r.body.postings.some(p=>p.account.startsWith('expense:')));
 const salesManifest={contract:'history-sales-v2',scope,orders,refunds,sourceEvents:events};
 const costManifest={contract:'history-cost-v2',scope,lines,returns:priorReturns,expenseEvents:costEvents};
 return {salesManifest,costManifest,selectedOrders,selectedRefunds,originalOrders:orders,priorRefunds:refunds,selectedLines:lines,selectedReturns,costEvents,salesRevision:digest(salesManifest),costRevision:digest(costManifest)};
}
export async function calculateHistorySources(tx,scope,coverage,options={}){
 const s=await historySources(tx,scope,options);
 const mapped=s.originalOrders.map(({body:o,event_date})=>({id:o.id,store_id:scope.storeId,currency:o.currency,day:event_date,mapping_state:'verified',original_eligible:true,tax_basis:'exclusive',gross:o.gross_sales,discount:o.discounts,gross_vat:o.gross_product_vat,discount_vat:o.discount_vat,shipping:o.shipping,shipping_vat:o.shipping_vat}));
 const refunds=s.priorRefunds.map(({body:r,event_date})=>({...r,currency:scope.currency,day:event_date,mapping_state:'verified'}));
 const sales=calculateMappedSales({orders:mapped,refunds,coverage:[{store_id:scope.storeId,currency:scope.currency,date_from:scope.from,date_to:scope.to,sales_and_refunds_complete:true,evidence_ref:`history-v2:${coverage.coverage_id}`}]},scope);
 let cogs=s.selectedLines.filter(l=>l.event_date>=scope.from&&l.event_date<=scope.to).reduce((sum,l)=>sum+l.body.quantity*l.body.historic_unit_cost_pence,0);
 for(const ret of s.selectedReturns){const line=s.selectedLines.find(l=>l.source_id===ret.body.line_id);ensure(line,'Unsupported stock return');cogs-=ret.body.quantity*line.body.historic_unit_cost_pence;}
 const costs={variableCosts:0,advertising:0,overheadIncludingDA:0,depreciationAmortisation:0};
 for(const e of s.costEvents)for(const p of e.body.postings){if(!p.account.startsWith('expense:'))continue;const category=p.account.slice(8);if(variable.has(category))costs.variableCosts+=p.amount;else if(category==='marketing')costs.advertising+=p.amount;else{costs.overheadIncludingDA+=p.amount;if(category==='depreciation')costs.depreciationAmortisation+=p.amount;}}
 return {...s,sales,components:{cogs,...costs},profit:profitBridge({...sales,cogs,...costs})};
}
async function historyReadContext(tx,scope,{now=()=>new Date(),selection}={}) {
  const contract=(await tx.query('SELECT *,date_from::text anchor,through_day::text through FROM finance_history_v2.contracts WHERE store_id=$1',[scope.storeId])).rows[0];
  const store=(await tx.query('SELECT currency_code,timezone FROM public.stores WHERE id=$1',[scope.storeId])).rows[0];
  const fail=reason=>({state:'unavailable',reason,contract:'history-v2-proposal'});
  if(!contract||contract.profile!=='uk-gifts-v2'||contract.edition!==HISTORY_EDITION||contract.currency!==scope.currency||contract.timezone!=='Europe/London'||contract.anchor>scope.from||contract.through<scope.to||store?.currency_code!==scope.currency||store?.timezone!=='Europe/London')return fail('History edition/scope unavailable');
  const {rows:coverage}=await tx.query("SELECT *,date_from::text scope_from,date_to::text scope_to FROM finance_history_v2.coverage WHERE store_id=$1 AND date_from=$2 AND date_to=$3 AND kind='month'",[scope.storeId,scope.from,scope.to]);
  if(coverage.length!==1)return fail('Exact month coverage unavailable');
  const {rows:seals}=await tx.query('SELECT * FROM finance_history_v2.seals WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[scope.storeId,scope.from,scope.to]);
  if(seals.length!==1)return fail('Sealed history unavailable');
  const c=coverage[0],base=seals[0];
  if(c.source_hash!==digest(c.source_manifest)||base.coverage_id!==c.coverage_id||digest(base.source_manifest)!==c.source_hash||c.source_manifest.profile!==contract.profile||c.source_manifest.scope.storeId!==scope.storeId||c.source_manifest.scope.from!==scope.from||c.source_manifest.scope.to!==scope.to||c.source_manifest.scope.currency!==scope.currency)return fail('Coverage/seal authority mismatch');
  const version=await resolveHistorySelection(tx,scope,base,selection);if(!version)return fail('Explicit selected history version required');
  const seal=version.seal,m=seal.source_manifest,clock=now();
  if(m.edition!==HISTORY_EDITION||m.anchor!==contract.anchor||m.formulaVersion!==HISTORY_FORMULA||m.sourceBasis!=='synthetic-local'||m.timezone!==contract.timezone||m.sourceAsOf!==historySourceAsOf(scope.to)||!Number.isFinite(Date.parse(m.observedAt))||Date.parse(m.observedAt)<Date.parse(m.sourceAsOf)||Date.parse(m.observedAt)>+clock||scope.to>=historyToday(clock))return fail('History metadata/horizon invalid');
  return {state:'resolved',contract,c,base,version,seal,m};
}
export async function readHistoryInTransaction(tx,scope,options={}){
 const context=await historyReadContext(tx,scope,options);if(context.state!=='resolved')return context;
 const {contract,c,version,seal,m}=context;
 const report=await calculateHistorySources(tx,scope,c,{overlays:version.overlays});
 if(report.salesRevision!==seal.sales_revision||report.costRevision!==seal.cost_revision||m.salesRevision!==report.salesRevision||m.costRevision!==report.costRevision)return {state:'unavailable',reason:'History evidence changed',contract:'history-v2-proposal'};
 return {state:'supported',contract:'history-v2-proposal',versionId:version.versionId,snapshotId:version.versionId,metadata:{edition:HISTORY_EDITION,versionId:version.versionId,anchor:contract.anchor,sourceAsOf:m.sourceAsOf,observedAt:m.observedAt,formulaVersion:HISTORY_FORMULA,sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},scope,sales:report.sales,components:report.components,profit:report.profit,report:{sales:report.sales,profit:report.profit,components:report.components},salesRevision:report.salesRevision,costRevision:report.costRevision};
}

const member=async(tx,scope,user)=>{await tx.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[user.id]);if((await tx.query('SELECT store_id FROM public.store_memberships WHERE store_id=$1 AND user_id=$2',[scope.storeId,user.id])).rows.length!==1)throw Error('History store membership required');};
export function createHistoryService(db,supabase,{now=()=>new Date()}={}){return {
 async read(scope,authorization,selection){
  if(!validProfitScope(scope))throw Error('Complete history month required');
  const user=await reviewerAuthenticator(supabase,authorization)();
  return db.transaction(async tx=>{await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');await member(tx,scope,user);return readHistoryInTransaction(tx,scope,{now,selection});});
 },
 async available(scope,authorization){
  if(!scope||Object.keys(scope).sort().join(',')!=='currency,storeId'||scope.currency!=='GBP'||typeof scope.storeId!=='string')throw Error('Invalid history availability scope');
  const user=await reviewerAuthenticator(supabase,authorization)();
  return db.transaction(async tx=>{
   await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');await member(tx,scope,user);
   const contract=(await tx.query('SELECT *,date_from::text anchor FROM finance_history_v2.contracts WHERE store_id=$1',[scope.storeId])).rows[0];
   const response={contract:'history-availability-v2',storeId:scope.storeId,currency:scope.currency,timezone:'Europe/London',edition:HISTORY_EDITION,anchor:contract?.anchor||null,verification:'sealed-candidates-only',requiresReadValidation:true,months:[]};
   if(!contract)return response;
   const rows=(await tx.query('SELECT s.snapshot_id,s.date_from::text,s.date_to::text,h.version_id FROM finance_history_v2.seals s LEFT JOIN finance_history_v2.version_heads h USING(store_id,date_from,date_to) WHERE s.store_id=$1 ORDER BY s.date_from',[scope.storeId])).rows;
   for(const row of rows){const period={...scope,from:row.date_from,to:row.date_to},chosen=row.version_id||row.snapshot_id;
    const result=await historyReadContext(tx,period,{now,selection:{edition:HISTORY_EDITION,versionId:chosen}});if(result.state!=='resolved')continue;
    const alternatives=(await tx.query('SELECT version_id FROM finance_history_v2.correction_versions WHERE store_id=$1 AND date_from=$2 AND date_to=$3 ORDER BY version_id',[scope.storeId,period.from,period.to])).rows;
    response.months.push({from:period.from,to:period.to,snapshotId:chosen,versionId:chosen,requiresExplicitSelection:true,versions:[{versionId:row.snapshot_id,status:chosen===row.snapshot_id?'selected':'invalidated',kind:'base'},...alternatives.map(v=>({versionId:v.version_id,status:v.version_id===chosen?'selected':'invalidated',kind:'expense-correction'}))]});
   }
   return response;
  });
 }
};}
