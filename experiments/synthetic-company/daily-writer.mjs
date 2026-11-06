/** Preparation only: restricted to branded clients of a new disposable Unix-socket cluster.
 * No URL, credentials, hosted driver, scheduler or operational binding is accepted.
 */
import {generate, addDays, date} from './generator.mjs';
import {prepareStagingPayload, RESERVED_SYNTHETIC_IDENTITY as identity, stableId} from './staging-payload.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {historySources, calculateHistorySources} from './history-reader.mjs';
import {HISTORY_EDITION,HISTORY_FORMULA,historyToday,historySourceAsOf} from './history-context.mjs';
const ensure=(v,m)=>{if(!v)throw Error(m);};
const clients=new WeakSet();
export function brandDisposableDailyClient(client,proof){ensure(proof?.kind==='new-disposable-unix-cluster'&&proof.host?.startsWith('/workspace/work/night-scout/')&&!proof.host.includes('..'),'New private local test cluster required');ensure(client.connectionParameters?.host===proof.host,'Exact disposable socket required');clients.add(client);return client;}
const tables=['events','orders','refunds','lines','returns'];
const end=day=>{const[y,m]=day.split('-').map(Number);return new Date(Date.UTC(y,m,0,12)).toISOString().slice(0,10);};
function row(source_id,event_date,body,extra={}){return {store_id:identity.storeId,source_id,event_date,body,row_hash:digest(body),...extra};}
export function prepareDailySources({asOf,anchor='2024-11-01',day}){
 date(asOf);date(anchor);date(day);ensure(day<asOf&&day>=anchor,'Completed in-edition day required');
 const f=generate({asOf,from:anchor});ensure(f.to===day,'Exactly one terminal completed day required');
 const p=prepareStagingPayload(f,{reviewerId:'80000000-0000-4000-8000-000000000001',identity,reviewed:true,from:day,to:day});
 const refs=new Set(p.orders.filter(o=>o.event_date<day).map(o=>o.shopify_order_id.replace('synthetic:uk-gifts-v2:','')));
 const events=f.events.filter(e=>e.date>=day||(e.kind==='sale'&&refs.has(e.refs.orderId))).map(e=>{const body=structuredClone(e);delete body.refs.openingCohort;return row(e.id,e.date,body,{kind:e.kind,order_ref:e.refs.orderId||null,dependency_only:e.date<anchor});});
 const mapped={events,orders:p.orders.map(o=>row(o.id,o.event_date,o)),refunds:p.refunds.map(r=>row(r.id,r.event_date,r)),lines:p.lines.map(l=>row(l.id,l.sale_date,l)),returns:p.returns.map(r=>row(r.source_return_id,r.saleable_date,{...r,store_id:identity.storeId}))};
 return {day,anchor,asOf,mapped,hash:digest({edition:HISTORY_EDITION,anchor,day,mapped})};
}
async function put(tx,table,rows){let inserted=0;for(let i=0;i<rows.length;i+=250){const batch=rows.slice(i,i+250),cols=['store_id','source_id','event_date','body','row_hash',...(table==='events'?['kind','order_ref','dependency_only']:[])];const result=await tx.query(`INSERT INTO finance_history_v2.${table} (${cols.join(',')}) SELECT ${cols.join(',')} FROM jsonb_populate_recordset(NULL::finance_history_v2.${table},$1::jsonb) ON CONFLICT(store_id,source_id) DO NOTHING RETURNING source_id`,[JSON.stringify(batch)]);inserted+=result.rowCount;const actual=(await tx.query(`SELECT to_jsonb(t)||jsonb_build_object('event_date',event_date::text) AS row FROM finance_history_v2.${table} t WHERE store_id=$1 AND source_id=ANY($2)`,[identity.storeId,batch.map(r=>r.source_id)])).rows;const found=new Map(actual.map(r=>[r.row.source_id,r.row]));ensure(batch.every(r=>digest(found.get(r.source_id))===digest(r)&&digest(r.body)===r.row_hash),'Immutable source conflict');}return inserted;}
async function seal(tx,from,to,kind,anchor,clock){const scope={storeId:identity.storeId,currency:'GBP',from,to},s=await historySources(tx,scope),coverage=stableId('history-coverage',`${kind}:${from}:${to}`);const manifest={contract:'history-v2-period',edition:HISTORY_EDITION,anchor,profile:'uk-gifts-v2',scope,timezone:'Europe/London',sourceBasis:'synthetic-local',formulaVersion:HISTORY_FORMULA,sourceAsOf:historySourceAsOf(to),observedAt:clock.toISOString(),salesRevision:s.salesRevision,costRevision:s.costRevision,counts:{orders:s.selectedOrders.length,refunds:s.selectedRefunds.length,lines:s.selectedLines.length,returns:s.selectedReturns.length,costSources:s.costEvents.length}};await tx.query('INSERT INTO finance_history_v2.coverage VALUES($1,$2,$3,$4,$5,$6,$7)',[coverage,identity.storeId,from,to,kind,manifest,digest(manifest)]);if(kind==='month'){const c=await calculateHistorySources(tx,scope,{coverage_id:coverage});ensure(c.salesRevision===s.salesRevision&&c.costRevision===s.costRevision,'Seal calculation changed');await tx.query('INSERT INTO finance_history_v2.seals VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[stableId('history-seal',`${from}:${to}`),identity.storeId,from,to,coverage,s.salesRevision,s.costRevision,manifest]);}}
export function createDisposableDailyWriter(client,{now=()=>new Date(),onLocked=async()=>{}}={}){ensure(clients.has(client),'Branded disposable PostgreSQL client required');return {
 async append(plan,{expectedThrough,failAt}={}){
  const clock=now();ensure(clock instanceof Date&&Number.isFinite(+clock)&&plan.asOf<=historyToday(clock)&&plan.day<historyToday(clock),'Current/future day refused');
  const canonical=prepareDailySources({asOf:plan.asOf,anchor:plan.anchor,day:plan.day});ensure(digest(plan)===digest(canonical),'Canonical source plan changed');
  ensure([undefined,'after-sources','before-commit'].includes(failAt),'Unknown failure injection');
  let commitAttempted=false;
  await client.query('BEGIN');try{await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['history-v2:'+identity.storeId]);await onLocked();
   const c=(await client.query('SELECT *,date_from::text anchor,through_day::text through FROM finance_history_v2.contracts WHERE store_id=$1 FOR UPDATE',[identity.storeId])).rows[0];
   ensure(c&&c.anchor===plan.anchor&&c.profile==='uk-gifts-v2'&&c.edition===HISTORY_EDITION&&c.currency==='GBP'&&c.timezone==='Europe/London','Pinned company/profile/edition/anchor required');
   const run=stableId('history-daily-run',`${plan.anchor}:${plan.day}`),prior=(await client.query('SELECT * FROM finance_history_v2.runs WHERE run_id=$1',[run])).rows[0];
   if(prior){ensure(prior.source_hash===plan.hash,'Receipt digest changed');await verifyCommitted(client,plan,prior);commitAttempted=true;await client.query('COMMIT');return {...prior.receipt,replay:true,inserted:0};}
   ensure(plan.day===addDays(historyToday(clock),-1),'Daily admission requires yesterday; review gaps separately');
   ensure(c.through===expectedThrough&&addDays(c.through,1)===plan.day,'Stale selection or noncontiguous day');
   let inserted=0;for(const table of tables)inserted+=await put(client,table,plan.mapped[table]);if(failAt==='after-sources')throw Error('Injected atomic failure');
   if(end(plan.day)===plan.day)await seal(client,plan.day.slice(0,7)+'-01',plan.day,'month',plan.anchor,clock);
   await seal(client,plan.day,plan.day,'day',plan.anchor,clock);
   await client.query('UPDATE finance_history_v2.contracts SET through_day=$2 WHERE store_id=$1',[identity.storeId,plan.day]);
   const receipt={contract:'synthetic-daily-preparation-v1',runId:run,day:plan.day,anchor:plan.anchor,edition:HISTORY_EDITION,profile:'uk-gifts-v2',sourceHash:plan.hash,sourceAsOf:historySourceAsOf(plan.day),inserted};
   await client.query('INSERT INTO finance_history_v2.runs VALUES($1,$2,$3,$3,$4,$5)',[run,identity.storeId,plan.day,plan.hash,receipt]);if(failAt==='before-commit')throw Error('Injected atomic failure');commitAttempted=true;await client.query('COMMIT');return {...receipt,replay:false};
  }catch(error){try{await client.query('ROLLBACK');}catch{}if(commitAttempted&&error&&typeof error==='object')error.commitOutcome='unknown-reconcile-before-retry';throw error;}
 },
 async reconcile(plan){await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{const r=(await client.query('SELECT * FROM finance_history_v2.runs WHERE run_id=$1 AND store_id=$2',[stableId('history-daily-run',`${plan.anchor}:${plan.day}`),identity.storeId])).rows[0];if(!r){await client.query('COMMIT');return {state:'absent-review-before-retry'};}await verifyCommitted(client,plan,r);await client.query('COMMIT');return {state:'committed-reconciled',receipt:r.receipt};}catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}}
 };}
/** Test-only publication adapter: imports an exact already-verified disposable fixture.
 * Deliberately absent from any runtime entrypoint or operational activation package. */
const fixtureColumns=Object.freeze({
 contracts:['store_id','profile','edition','date_from','through_day','currency','timezone'],
 events:['store_id','source_id','event_date','kind','order_ref','dependency_only','body','row_hash'],
 orders:['store_id','source_id','event_date','body','row_hash'],
 refunds:['store_id','source_id','event_date','body','row_hash'],
 lines:['store_id','source_id','event_date','body','row_hash'],
 returns:['store_id','source_id','event_date','body','row_hash'],
 coverage:['coverage_id','store_id','date_from','date_to','kind','source_manifest','source_hash'],
 seals:['snapshot_id','store_id','date_from','date_to','coverage_id','sales_revision','cost_revision','source_manifest'],
 invalidations:['snapshot_id','reason'],
 runs:['run_id','store_id','date_from','date_to','source_hash','receipt'],
});
const fixtureOrder=['contracts',...tables,'coverage','seals','invalidations','runs'];
function validateFixture(snapshot){
 ensure(snapshot&&Object.keys(snapshot).sort().join()===Object.keys(fixtureColumns).sort().join(),'Exact fixture table set required');
 ensure(Array.isArray(snapshot.contracts)&&Array.isArray(snapshot.invalidations)&&snapshot.contracts.length===1&&snapshot.invalidations.length===0,'Single uninvalidated fixture edition required');
 const c=snapshot.contracts[0];ensure(c.store_id===identity.storeId&&c.profile==='uk-gifts-v2'&&c.edition===HISTORY_EDITION&&c.currency==='GBP'&&c.timezone==='Europe/London','Fixture company/profile/edition differs');
 date(c.date_from);date(c.through_day);ensure(c.date_from==='2024-11-01'&&c.through_day>=c.date_from,'Fixture anchor/horizon differs');
 for(const table of fixtureOrder){ensure(Array.isArray(snapshot[table]),'Fixture rows required');for(const r of snapshot[table]){
  ensure(r&&Object.keys(r).sort().join()===fixtureColumns[table].slice().sort().join(),'Fixture columns differ');
  ensure(r.store_id===identity.storeId,'Fixture company scope differs');
  if(r.body)ensure(r.row_hash===digest(r.body),'Fixture body hash differs');
 }}
}
async function verifyFixtureRows(client,snapshot){
 for(const table of fixtureOrder){
  const where=table==='invalidations'?'snapshot_id IN (SELECT snapshot_id FROM finance_history_v2.seals WHERE store_id=$1)':'store_id=$1';
  const rows=(await client.query(`SELECT to_jsonb(t) row FROM finance_history_v2.${table} t WHERE ${where}`,[identity.storeId])).rows.map(r=>r.row);
  const normal=rows=>rows.map(digest).sort();
  ensure(digest(normal(rows))===digest(normal(snapshot[table])),'Initial fixture retained rows differ');
 }
}
export async function initialiseDisposableDailyFixture(client,snapshot,{onLocked=async()=>{}}={}){
 ensure(clients.has(client),'Branded disposable client required');validateFixture(snapshot);const hash=digest(snapshot);
 await client.query('BEGIN');try{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['history-v2:'+identity.storeId]);await onLocked();
  const present=(await client.query('SELECT fixture_hash FROM public.disposable_fixture_receipts WHERE store_id=$1',[identity.storeId])).rows[0];
  if(present){ensure(present.fixture_hash===hash,'Initial fixture differs');await verifyFixtureRows(client,snapshot);await client.query('COMMIT');return {replay:true,hash};}
  ensure((await client.query('SELECT count(*)::int n FROM finance_history_v2.contracts WHERE store_id=$1',[identity.storeId])).rows[0].n===0,'Occupied fixture refused');
  for(const table of fixtureOrder)for(let i=0;i<snapshot[table].length;i+=250){const rows=snapshot[table].slice(i,i+250),cols=fixtureColumns[table];await client.query(`INSERT INTO finance_history_v2.${table} (${cols.join(',')}) SELECT ${cols.join(',')} FROM jsonb_populate_recordset(NULL::finance_history_v2.${table},$1::jsonb)`,[JSON.stringify(rows)]);}
  await verifyFixtureRows(client,snapshot);await client.query('INSERT INTO public.disposable_fixture_receipts VALUES($1,$2)',[identity.storeId,hash]);await client.query('COMMIT');return {replay:false,hash};
 }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}
}

async function verifyCommitted(client,plan,r){
 ensure(digest(plan)===digest(prepareDailySources({asOf:plan.asOf,anchor:plan.anchor,day:plan.day})),'Canonical source plan changed');
 const runId=stableId('history-daily-run',`${plan.anchor}:${plan.day}`),receipt=r.receipt;
 ensure(r.run_id===runId&&r.store_id===identity.storeId&&String(r.date_from instanceof Date?r.date_from.toISOString().slice(0,10):r.date_from)===plan.day&&String(r.date_to instanceof Date?r.date_to.toISOString().slice(0,10):r.date_to)===plan.day&&r.source_hash===plan.hash&&receipt.contract==='synthetic-daily-preparation-v1'&&receipt.runId===runId&&receipt.edition===HISTORY_EDITION&&receipt.profile==='uk-gifts-v2'&&Number.isSafeInteger(receipt.inserted)&&receipt.inserted>=0&&receipt.sourceHash===plan.hash&&receipt.day===plan.day&&receipt.anchor===plan.anchor&&receipt.sourceAsOf===historySourceAsOf(plan.day),'Uncertain receipt differs');
 const c=(await client.query('SELECT *,date_from::text anchor,through_day::text through FROM finance_history_v2.contracts WHERE store_id=$1',[identity.storeId])).rows[0];
 ensure(c&&c.anchor===plan.anchor&&c.through>=plan.day&&c.profile==='uk-gifts-v2'&&c.edition===HISTORY_EDITION&&c.currency==='GBP'&&c.timezone==='Europe/London','Receipt contract differs');
 for(const table of tables)for(let i=0;i<plan.mapped[table].length;i+=250){const batch=plan.mapped[table].slice(i,i+250);const actual=(await client.query(`SELECT to_jsonb(t)||jsonb_build_object('event_date',event_date::text) AS row FROM finance_history_v2.${table} t WHERE store_id=$1 AND source_id=ANY($2)`,[identity.storeId,batch.map(r=>r.source_id)])).rows;const found=new Map(actual.map(r=>[r.row.source_id,r.row]));ensure(batch.every(row=>found.has(row.source_id)&&digest(found.get(row.source_id))===digest(row)),'Receipt/source mismatch');}
 async function verifyCoverage(from,to,kind){
  const coverage=(await client.query('SELECT * FROM finance_history_v2.coverage WHERE store_id=$1 AND date_from=$2 AND date_to=$3 AND kind=$4',[identity.storeId,from,to,kind])).rows;
  ensure(coverage.length===1,'Receipt coverage missing');const row=coverage[0],m=row.source_manifest,scope={storeId:identity.storeId,currency:'GBP',from,to};
  ensure(digest(m)===row.source_hash&&m.contract==='history-v2-period'&&digest(m.scope)===digest(scope)&&m.profile==='uk-gifts-v2'&&m.timezone==='Europe/London'&&m.formulaVersion===HISTORY_FORMULA&&m.sourceBasis==='synthetic-local'&&m.sourceAsOf===historySourceAsOf(to)&&Number.isFinite(Date.parse(m.observedAt))&&Date.parse(m.observedAt)>=Date.parse(m.sourceAsOf)&&m.anchor===plan.anchor&&m.edition===HISTORY_EDITION,'Receipt coverage metadata differs');
  const actual=await historySources(client,scope);ensure(actual.salesRevision===m.salesRevision&&actual.costRevision===m.costRevision,'Receipt canonical source evidence differs');return {row,m,scope};
 }
 await verifyCoverage(plan.day,plan.day,'day');
 if(end(plan.day)===plan.day){const {row,m,scope}=await verifyCoverage(plan.day.slice(0,7)+'-01',plan.day,'month');const snapshot=stableId('history-seal',`${scope.from}:${scope.to}`);const seals=(await client.query('SELECT * FROM finance_history_v2.seals WHERE snapshot_id=$1 AND store_id=$2',[snapshot,identity.storeId])).rows;ensure(seals.length===1&&seals[0].coverage_id===row.coverage_id&&digest(seals[0].source_manifest)===digest(m)&&seals[0].sales_revision===m.salesRevision&&seals[0].cost_revision===m.costRevision,'Receipt complete-month seal differs');ensure(!(await client.query('SELECT snapshot_id FROM finance_history_v2.invalidations WHERE snapshot_id=$1',[snapshot])).rows.length,'Receipt month evidence invalidated; review required');const hasHeads=(await client.query("SELECT to_regclass('finance_history_v2.version_heads') IS NOT NULL present")).rows[0].present;if(hasHeads)ensure(!(await client.query('SELECT version_id FROM finance_history_v2.version_heads WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[identity.storeId,scope.from,scope.to])).rows.length,'Receipt month selection changed; review required');}
}
