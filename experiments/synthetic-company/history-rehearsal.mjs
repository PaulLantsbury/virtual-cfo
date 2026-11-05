/** Proposed history edition. Writes ONLY newly-created in-memory PostgreSQL handles. */
import {HISTORY_EDITION,HISTORY_FORMULA,historyToday,historySourceAsOf} from './history-context.mjs';
import {readFile} from 'node:fs/promises';
import {generate,addDays,date} from './generator.mjs';
import {prepareStagingPayload,RESERVED_SYNTHETIC_IDENTITY as identity,stableId} from './staging-payload.mjs';
import {createStagingRehearsal,executeStagingRehearsal,stagingFingerprints} from './staging-rehearsal.mjs';
import {createProfitReportingService} from '../financial-v1/profit-reporting-service.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {historySources,calculateHistorySources,createHistoryService} from './history-reader.mjs';
export {createHistoryService};
export const HISTORY_TABLES=Object.freeze(['contracts','events','orders','refunds','lines','returns','coverage','seals','invalidations','runs']);
const handles=new WeakSet(),ensure=(x,m)=>{if(!x)throw Error(m);};
const firstPreviousMonth=day=>{const[y,m]=day.split('-').map(Number);return new Date(Date.UTC(y,m-2,1,12)).toISOString().slice(0,10);};
const monthEnd=day=>{const[y,m]=day.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);};
const norm=e=>{const body=structuredClone(e);delete body.refs.openingCohort;return body;};
async function put(tx,table,rows){
 let inserted=0;
 for(let i=0;i<rows.length;i+=250){const chunk=rows.slice(i,i+250);
  const columns=['store_id','source_id','event_date','body','row_hash',...(table==='events'?['kind','order_ref','dependency_only']:[])];
  const out=await tx.query(`INSERT INTO finance_history_v2.${table} (${columns.join(',')}) SELECT ${columns.join(',')} FROM jsonb_populate_recordset(NULL::finance_history_v2.${table},$1::jsonb) ON CONFLICT(store_id,source_id) DO NOTHING RETURNING source_id`,[JSON.stringify(chunk)]);inserted+=out.rows.length;
  const current=(await tx.query(`SELECT source_id,event_date::text,body,row_hash${table==='events'?',kind,order_ref,dependency_only':''} FROM finance_history_v2.${table} WHERE store_id=$1 AND source_id=ANY($2)`,[identity.storeId,chunk.map(r=>r.source_id)])).rows;
  const actual=new Map(current.map(r=>[r.source_id,r]));ensure(chunk.every(r=>{const a=actual.get(r.source_id);return a&&a.row_hash===r.row_hash&&digest(a.body)===r.row_hash&&a.event_date===r.event_date&&(table!=='events'||(a.kind===r.kind&&a.order_ref===r.order_ref&&a.dependency_only===r.dependency_only));}),'Immutable history source conflict');
 }
 return inserted;
}
function row(id,day,body,extra={}){return {store_id:identity.storeId,source_id:id,event_date:day,body,row_hash:digest(body),...extra};}
function sourcePlan({asOf,from},windowFrom=from){
 const f=generate({asOf,from}),payload=prepareStagingPayload(f,{reviewerId:'80000000-0000-4000-8000-000000000001',identity,reviewed:true,from:windowFrom,to:f.to});
 const originalIds=new Set(payload.orders.filter(o=>o.event_date<windowFrom).map(o=>o.shopify_order_id.replace('synthetic:uk-gifts-v2:','')));
 const existingEvents=f.events.filter(e=>e.date>=windowFrom),presentIds=new Set(existingEvents.filter(e=>e.kind==='sale').map(e=>e.refs.orderId));
 const missing=new Set([...originalIds].filter(id=>!presentIds.has(id)));
 // Retain actual generator originals, including originals older than this selected day.
 const warm=missing.size?generate({asOf:windowFrom,from:firstPreviousMonth(windowFrom)}):null;
 const originals=[...f.events.filter(e=>e.kind==='sale'&&missing.has(e.refs.orderId)),...(warm?.events||[]).filter(e=>e.kind==='sale'&&missing.has(e.refs.orderId))];
 const events=[...new Map([...originals,...existingEvents].map(e=>[e.id,e])).values()].map(e=>row(e.id,e.date,norm(e),{kind:e.kind,order_ref:e.refs.orderId||null,dependency_only:e.date<from}));
 const mapped={events,orders:payload.orders.map(o=>row(o.id,o.event_date,o)),refunds:payload.refunds.map(r=>row(r.id,r.event_date,r)),lines:payload.lines.map(l=>row(l.id,l.sale_date,l)),returns:payload.returns.map(r=>row(r.source_return_id,r.saleable_date,{...r,store_id:identity.storeId}))};
 const manifest={contract:'history-v2-source-plan',profile:'uk-gifts-v2',from:windowFrom,to:f.to,rows:Object.fromEntries(Object.entries(mapped).map(([k,rows])=>[k,rows.map(r=>[r.source_id,r.row_hash]).sort(([a],[b])=>a.localeCompare(b))]))};
 return {fixture:f,mapped,sourceHash:digest(manifest),manifest};
}
export async function historyFingerprints(handle){ensure(handles.has(handle),'Disposable history handle required');const rows={};for(const table of HISTORY_TABLES)rows[table]=(await handle.db.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM finance_history_v2.${table} t`)).rows[0].rows;return {v1:await stagingFingerprints(handle.db),v2:digest(rows)};}
export async function createHistoryRehearsal({reviewerId,withLoadedJanuary=true,now=()=>new Date()}={}){
 const base=await createStagingRehearsal(reviewerId?{reviewerId}:{});
 try{
  if(withLoadedJanuary){const f=generate({asOf:'2025-02-01',from:'2025-01-01'}),p=prepareStagingPayload(f,{reviewerId:base.reviewerId,identity,reviewed:true,from:'2025-01-01',to:'2025-01-31'});await executeStagingRehearsal(base,p,{mode:'commit-local'});}
  else{await base.db.query("INSERT INTO public.stores(id,shopify_domain,shopify_store_id,name,currency_code,timezone) VALUES($1,$2,$3,$4,'GBP','Europe/London')",[identity.storeId,identity.domain,identity.externalId,identity.name]);await base.db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[base.reviewerId,identity.storeId]);}
  await base.db.exec(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));
  const h=Object.freeze({db:base.db,storeId:identity.storeId,reviewerId:base.reviewerId,kind:'disposable-history-v2',now});handles.add(h);return h;
 }catch(e){await base.db.close();throw e;}
}
async function seal(tx,from,to,kind,{anchor,now}){
 const scope={storeId:identity.storeId,currency:'GBP',from,to},sources=await historySources(tx,scope),coverageId=stableId('history-coverage',`${kind}:${from}:${to}`);
 const manifest={contract:'history-v2-period',edition:HISTORY_EDITION,anchor,profile:'uk-gifts-v2',scope,timezone:'Europe/London',sourceBasis:'synthetic-local',formulaVersion:HISTORY_FORMULA,sourceAsOf:historySourceAsOf(to),observedAt:now.toISOString(),salesRevision:sources.salesRevision,costRevision:sources.costRevision,counts:{orders:sources.selectedOrders.length,refunds:sources.selectedRefunds.length,lines:sources.selectedLines.length,returns:sources.selectedReturns.length,costSources:sources.costEvents.length}};
 await tx.query('INSERT INTO finance_history_v2.coverage VALUES($1,$2,$3,$4,$5,$6,$7)',[coverageId,identity.storeId,from,to,kind,JSON.stringify(manifest),digest(manifest)]);
 if(kind==='month'){
  const calculated=await calculateHistorySources(tx,scope,{coverage_id:coverageId});
  ensure(calculated.salesRevision===sources.salesRevision&&calculated.costRevision===sources.costRevision,'Inconsistent period evidence');
  await tx.query('INSERT INTO finance_history_v2.seals VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[stableId('history-seal',`${from}:${to}`),identity.storeId,from,to,coverageId,sources.salesRevision,sources.costRevision,JSON.stringify(manifest)]);
 }
}
async function apply(handle,options,{daily=false,date:businessDay,failAt=null}={}){
 ensure(handles.has(handle),'Only newly-created disposable history databases accepted');
 ensure([null,'after-sources','before-seal','before-commit'].includes(failAt),'Unknown failure injection');
 const asOf=options.asOf||'2026-11-05',from=options.from||'2024-11-01';date(asOf);date(from);const clock=handle.now();ensure(clock instanceof Date&&Number.isFinite(+clock),'Verified reference clock required');ensure(asOf<=historyToday(clock),'Future history horizon refused');
 if(daily){date(businessDay);ensure(businessDay<asOf,'Future/current-day actuals refused');}
 const plan=sourcePlan({asOf,from},daily?businessDay:from),through=plan.fixture.to;
 if(daily)ensure(through===businessDay,'A daily append requires exactly the next completed day');
 const beforeV1=await stagingFingerprints(handle.db),runFrom=daily?businessDay:from,runId=stableId('history-run',`${runFrom}:${through}`);
 return handle.db.transaction(async tx=>{
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['history-v2:'+identity.storeId]);
  const contract=(await tx.query('SELECT *,date_from::text anchor,through_day::text through FROM finance_history_v2.contracts WHERE store_id=$1 FOR UPDATE',[identity.storeId])).rows[0];
  const prior=(await tx.query('SELECT * FROM finance_history_v2.runs WHERE run_id=$1',[runId])).rows[0];
  if(prior){ensure(prior.source_hash===plan.sourceHash,'Replay source digest differs');for(const [table,rows]of Object.entries(plan.mapped))await put(tx,table,rows);return {...prior.receipt,replay:true,inserted:0};}
  if(daily)ensure(contract&&contract.anchor===from&&addDays(contract.through,1)===businessDay,'Daily append must be contiguous and retain the original anchor');
  else ensure(!contract,'Existing history edition requires daily append, not reseeding');
  let inserted=0;for(const [table,rows]of Object.entries(plan.mapped))inserted+=await put(tx,table,rows);
  if(failAt==='after-sources'||failAt==='before-seal')throw Error('Injected history failure before sealing');
  if(!daily){await tx.query("INSERT INTO finance_history_v2.contracts(store_id,profile,edition,date_from,through_day,currency,timezone) VALUES($1,'uk-gifts-v2','synthetic-history-v2-2026-11',$2,$3,'GBP','Europe/London')",[identity.storeId,from,through]);for(let start=from;monthEnd(start)<=through;start=addDays(monthEnd(start),1))await seal(tx,start,monthEnd(start),'month',{anchor:from,now:clock});}
  else{if(monthEnd(businessDay)===businessDay)await seal(tx,businessDay.slice(0,7)+'-01',businessDay,'month',{anchor:from,now:clock});await tx.query('UPDATE finance_history_v2.contracts SET through_day=$2 WHERE store_id=$1',[identity.storeId,businessDay]);}
  await seal(tx,daily?businessDay:through,through,'day',{anchor:from,now:clock});
  ensure(await stagingFingerprints(tx)===beforeV1,'Loaded v1 January or unrelated stores changed');
  const receipt={contract:'history-v2-proposal',runId,from:runFrom,to:through,sourceHash:plan.sourceHash,inserted,replay:false,remoteApplied:false};
  await tx.query('INSERT INTO finance_history_v2.runs VALUES($1,$2,$3,$4,$5,$6)',[runId,identity.storeId,runFrom,through,plan.sourceHash,JSON.stringify(receipt)]);
  if(failAt==='before-commit')throw Error('Injected history failure before commit');return receipt;
 });
}
export const importHistory=(h,options={})=>apply(h,options,{failAt:options.failAt||null});
export const appendHistoryDay=(h,options={})=>apply(h,options,{daily:true,date:options.date,failAt:options.failAt||null});
export async function invalidateHistoryMonth(handle,{from,to,reason}={}){ensure(handles.has(handle),'Disposable history handle required');ensure(reason&&typeof reason==='string','Explicit correction review reason required');const rows=(await handle.db.query('SELECT snapshot_id FROM finance_history_v2.seals WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[identity.storeId,from,to])).rows;ensure(rows.length===1,'Exact existing month required');await handle.db.query('INSERT INTO finance_history_v2.invalidations VALUES($1,$2)',[rows[0].snapshot_id,reason]);return {state:'invalidated',snapshotId:rows[0].snapshot_id,remoteApplied:false};}
