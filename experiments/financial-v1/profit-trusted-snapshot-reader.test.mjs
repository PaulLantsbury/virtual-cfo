import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,sql,U} from '../shopify/finance-fixture.mjs';
import {setupProfitStagingFixture,PROFIT_STAGING_IDS as ids} from './profit-staging-fixture.mjs';
import {createProfitSalesReader} from './profit-sales-reader.mjs';
import {profitEvidenceDigest} from './profit-evidence-reader.mjs';
import {createProfitReportingService} from './profit-reporting-service.mjs';
import {TRUSTED_PROFIT_FORMULA} from './profit-trusted-snapshot-reader.mjs';
const scope={storeId:ids.store,from:'2026-02-01',to:'2026-02-28',currency:'GBP'};
const outsider='96000000-0000-4000-8000-000000000099';
const policy={storeId:scope.storeId,sourceBasis:'synthetic-local',profileVersion:'uk-gifts-v2',formulaVersion:TRUSTED_PROFIT_FORMULA};
const id=n=>`a2600000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function fixture({schema=true}={}) {
 const {db}=await setup(undefined,{installIntake:false});
 await db.exec(sql('proposals/20260913_profit_evidence.sql'));
 await setupProfitStagingFixture(db,{userId:U,readSales:createProfitSalesReader({userId:U})});
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[outsider]);
 if(schema)await db.exec(await readFile(new URL('../synthetic-company/staging-snapshot-schema.sql',import.meta.url),'utf8'));
 const source=await db.transaction(tx=>createProfitSalesReader({userId:U})(tx,scope));
 const manifest=(await db.query('SELECT source_manifest FROM finance_v1.profit_evidence_versions WHERE id=$1',[ids.versions[0]])).rows[0].source_manifest;
 const auth={auth:{getUser:async token=>token==='valid'?{data:{user:{id:U,is_anonymous:false}},error:null}:token==='outsider'?{data:{user:{id:outsider,is_anonymous:false}},error:null}:{data:{user:null},error:Error('private-auth-diagnostic')}}};
 const base={snapshot_id:id(1),store_id:scope.storeId,date_from:scope.from,date_to:scope.to,currency:'GBP',timezone:'Europe/London',source_basis:'synthetic-local',formula_version:TRUSTED_PROFIT_FORMULA,contract_version:1,sales_revision:source.revision,profit_version_id:ids.versions[0],source_as_of:'2026-03-01T00:00:00Z',observed_at:'2026-03-01T01:00:00Z',manifest_digest:profitEvidenceDigest(manifest),profile_version:'uk-gifts-v2',coverage:{sales:'complete',costs:'complete'}};
 const insert=async(patch={})=>{const row={...base,...patch},keys=Object.keys(row);await db.query(`INSERT INTO finance_v1.reporting_snapshots (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row).map(v=>v&&typeof v==='object'?JSON.stringify(v):v));return row;};
 return {db,auth,base,insert,service:createProfitReportingService(db,auth,{snapshotPolicy:policy})};
}
test('authenticated same-transaction reader exposes verified source as-of and opaque coverage only',async()=>{
 const f=await fixture();try {
  await f.insert();const log=[];let transactions=0;
  const tracked={transaction:fn=>{transactions++;return f.db.transaction(tx=>fn({query:(text,args)=>{log.push(text);return tx.query(text,args);},exec:text=>{log.push(text);return tx.exec(text);}}));}};
  const service=createProfitReportingService(tracked,f.auth,{snapshotPolicy:policy}),r=await service.read(scope,'Bearer valid');
  assert.equal(transactions,1);assert.match(log[0],/REPEATABLE READ, READ ONLY/);
  const membership=log.findIndex(s=>s.startsWith('SELECT store_id FROM public.store_memberships'));
  const metadata=log.findIndex(s=>s.includes('FROM finance_v1.reporting_snapshots'));
  assert.ok(membership>=0&&metadata>membership);assert.ok(log[metadata].includes('reporting_snapshot_invalidations'));
  assert.equal(r.trustedSnapshot.state,'supported');assert.equal(r.trustedSnapshot.verification,'canonical-current');
  assert.equal(r.trustedSnapshot.metadata.sourceAsOf,'2026-03-01T00:00:00.000000Z');
  assert.equal(r.trustedSnapshot.metadata.coverageReference,`reporting-snapshot:${id(1)}`);
  assert.equal(r.trustedSnapshot.metadata.providerFreshness,'unverified');assert.equal(r.report.operatingProfit.value,3500);
  const text=JSON.stringify(r);for(const secret of [f.base.sales_revision,f.base.manifest_digest,'source_manifest','observed_at','verified_by','SYNTHETIC explicit'])assert.ok(!text.includes(secret),secret);
 }finally{await f.db.close();}
});
test('missing metadata configuration/schema is fail closed while existing reporting remains usable',async()=>{
 const f=await fixture({schema:false});try {
  const off=await createProfitReportingService(f.db,f.auth).read(scope,'Bearer valid');
  const missing=await f.service.read(scope,'Bearer valid');
  for(const r of [off,missing]){assert.equal(r.trustedSnapshot.state,'unavailable');assert.equal(r.trustedSnapshot.metadata,null);assert.equal(r.report.operatingProfit.value,3500);}
  assert.equal((await f.db.query('SELECT 1 n')).rows[0].n,1,'savepoint recovers the transaction after unavailable table');
 }finally{await f.db.close();}
});
test('nonmember and invalid token cannot select snapshots',async()=>{
 const f=await fixture();try{
  await f.insert();await assert.rejects(f.service.read(scope,'Bearer outsider'),/membership/);
  await assert.rejects(f.service.read(scope,'Bearer invalid'),/verified/);
 }finally{await f.db.close();}
});
test('wrong revision/digest/formula/profile and future timestamps cannot manufacture support',async()=>{
 for(const patch of [{sales_revision:'invented'},{manifest_digest:'a'.repeat(64)},{formula_version:'wrong'},{profile_version:'uk-gifts-v1'},{source_as_of:'2099-01-01T00:00:00Z',observed_at:'2099-01-02T00:00:00Z'}]) {
  const f=await fixture();try{await f.insert(patch);const r=await f.service.read(scope,'Bearer valid');assert.equal(r.trustedSnapshot.state,'unavailable',JSON.stringify(patch));assert.equal(r.trustedSnapshot.metadata,null);}finally{await f.db.close();}
 }
});
test('invalidated and ambiguous candidates fail closed; only explicit invalidation permits replacement',async()=>{
 const f=await fixture();try{
  await f.insert();await f.insert({snapshot_id:id(2)});
  assert.equal((await f.service.read(scope,'Bearer valid')).trustedSnapshot.state,'unavailable');
  await f.db.query("INSERT INTO finance_v1.reporting_snapshot_invalidations VALUES($1,$2,'2026-03-02','Replaced explicitly')",[id(1),scope.storeId]);
  const replacement=await f.service.read(scope,'Bearer valid');assert.equal(replacement.trustedSnapshot.metadata.snapshotId,id(2));
  await f.db.query("INSERT INTO finance_v1.reporting_snapshot_invalidations VALUES($1,$2,'2026-03-02','Invalidated')",[id(2),scope.storeId]);
  assert.equal((await f.service.read(scope,'Bearer valid')).trustedSnapshot.state,'unavailable');
 }finally{await f.db.close();}
});
test('real source and cost edits invalidate trusted metadata without hiding independently supported legacy figures',async()=>{
 for(const edit of ["UPDATE public.orders SET order_number='source changed' WHERE id=$1","UPDATE public.overhead_entries SET amount=21 WHERE id=$1"]) {
  const f=await fixture();try{
   await f.insert();const target=edit.includes('overhead')?ids.expenses[1]:ids.orders[0];await f.db.query(edit,[target]);
   const r=await f.service.read(scope,'Bearer valid');assert.equal(r.trustedSnapshot.state,'unavailable');assert.equal(r.trustedSnapshot.metadata,null);
   assert.ok(r.report.sales,'legacy sales remain independently evaluated');
  }finally{await f.db.close();}
 }
});
test('source-basis overrides and comparison requests never fall back to another scope',async()=>{
 const f=await fixture();try{
  await f.insert();
  for(const patch of [{sourceBasis:'xero-accounting'},{storeId:outsider},{formulaVersion:'future'}]){
   const r=await createProfitReportingService(f.db,f.auth,{snapshotPolicy:{...policy,...patch}}).read(scope,'Bearer valid');assert.equal(r.trustedSnapshot.state,'unavailable');
  }
  const prior=await f.service.read({...scope,from:'2025-02-01',to:'2025-02-28'},'Bearer valid');assert.equal(prior.state,'unavailable');assert.equal(prior.report,undefined);
  await assert.rejects(f.service.read({...scope,refreshState:'current'},'Bearer valid'),/scope/);
 }finally{await f.db.close();}
});

test('explicit incomplete cost coverage preserves verified sales and independently supported subtotals',async()=>{
 const f=await fixture();try{
  await f.insert({coverage:{sales:'complete',costs:'incomplete'}});
  await f.db.query('UPDATE public.overhead_entries SET amount=21 WHERE id=$1',[ids.expenses[1]]);
  const r=await f.service.read(scope,'Bearer valid');
  assert.equal(r.trustedSnapshot.state,'partial');assert.equal(r.trustedSnapshot.metadata.coverage.costs,'incomplete');
  assert.equal(r.report.sales.netProductSales,14000);assert.equal(r.report.grossProfit.value,8000);
  assert.equal(r.report.operatingProfit.state,'unavailable');assert.equal(r.report.operatingProfit.value,null);
 }finally{await f.db.close();}
});

test('default two-argument service leaves other stores unchanged and explicit null disables snapshot reads',async()=>{
 const f=await fixture();try{
  const queries=[];
  const tracked={transaction:fn=>f.db.transaction(tx=>fn({query:(text,args)=>{queries.push(text);return tx.query(text,args);},exec:text=>tx.exec(text)}))};
  for(const options of [undefined,{snapshotPolicy:null}]){
   queries.length=0;const service=createProfitReportingService(tracked,f.auth,options);
   const r=await service.read(scope,'Bearer valid');assert.equal(r.report.operatingProfit.value,3500);
   assert.equal(r.trustedSnapshot.state,'unavailable');assert.ok(!queries.some(q=>q.includes('reporting_snapshots')));
  }
 }finally{await f.db.close();}
});
