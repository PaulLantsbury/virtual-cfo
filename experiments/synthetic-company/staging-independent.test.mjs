import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from './generator.mjs';
import {prepareStagingPayload,RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const reviewerId='10000000-0000-4000-8000-000000000001';
const options={reviewerId,identity,from:'2025-01-01',to:'2025-01-31',reviewed:true};
const fixture=generate({asOf:'2025-02-01',from:'2025-01-01'});
test('physical quantity-one lines reconcile all retained original order amounts and costs',()=>{
 const p=prepareStagingPayload(fixture,options),byId=new Map(p.lines.map(l=>[l.id,l]));
 for(const o of p.orders){const lines=p.lines.filter(l=>l.order_id===o.id);assert.ok(lines.length>=1&&lines.length<=2);assert.ok(lines.every(l=>l.quantity===1&&Number.isSafeInteger(l.historic_unit_cost_pence)));assert.equal(Math.round(lines.reduce((s,l)=>s+Number(l.total),0)*100),Math.round(Number(o.net_sales)*100));}
 for(const r of p.returns){assert.equal(r.quantity,1);assert.ok(byId.has(r.line_id));const refund=p.refunds.find(f=>f.id===r.refund_id);assert.equal(Math.round(Number(byId.get(r.line_id).total)*100),Math.round((Number(refund.product_cash)-Number(refund.product_vat))*100));assert.equal(r.saleable_date,refund.event_date);}
 assert.ok(p.orders.some(o=>o.event_date<options.from),'genuine retained opening originals');
 assert.equal(p.coverage.length,1);assert.equal(p.scopes.length,1);assert.equal(p.scopes[0].from,options.from);assert.equal(p.scopes[0].to,options.to);
});
test('review gate, identity and current profile refusals are enforced',()=>{
 for(const override of [{reviewed:false},{identity:{...identity,storeId:'10000000-0000-4000-8000-000000000002'}},{reviewerId:undefined}])assert.throws(()=>prepareStagingPayload(fixture,{...options,...override}));
 const mixed=structuredClone(fixture);mixed.events[0].company='fictional-other';assert.throws(()=>prepareStagingPayload(mixed,options));
 const altered=structuredClone(fixture);altered.events[0].postings[0].amount++;altered.events[0].postings[1].amount--;assert.throws(()=>prepareStagingPayload(altered,options),/fingerprint|deterministic/i);
});

import {createStagingRehearsal,executeStagingRehearsal,readStagingProfit,stagingFingerprints} from './staging-rehearsal.mjs';
import {summarise} from './generator.mjs';
test('disposable SQL rollback, commit, exact replay and unrelated preservation; canonical allowed/denied reader',async()=>{
 const h=await createStagingRehearsal();
 try{
  const p=prepareStagingPayload(fixture,{...options,reviewerId:h.reviewerId});
  const before=await stagingFingerprints(h.db),other=await stagingFingerprints(h.db,{excludeTarget:true});
  const rolled=await executeStagingRehearsal(h,p);assert.equal(rolled.status,'local-rehearsal-rolled-back');assert.equal(await stagingFingerprints(h.db),before);
  for(const failAt of ['after-sources','before-commit']){await assert.rejects(executeStagingRehearsal(h,p,{mode:'commit-local',failAt}),/Injected/);assert.equal(await stagingFingerprints(h.db),before);}
  await executeStagingRehearsal(h,p,{mode:'commit-local'});assert.equal(await stagingFingerprints(h.db,{excludeTarget:true}),other);
  const actual=await readStagingProfit(h,p.scopes[0]),expected=summarise(fixture,options.from,options.to);
  assert.equal(actual.readError,null);assert.equal(actual.result.sales.netProductSales,expected.netProduct);assert.equal(actual.result.operatingProfit.value,expected.operatingProfit);assert.equal(actual.result.ebitda.value,expected.ebitda);
  await assert.rejects(readStagingProfit(h,p.scopes[0],{userId:reviewerId}),/membership required/);
  const applied=await stagingFingerprints(h.db);assert.equal((await executeStagingRehearsal(h,p,{mode:'commit-local'})).inserted,0);assert.equal(await stagingFingerprints(h.db),applied);
  await assert.rejects(executeStagingRehearsal({db:h.db,reviewerId:h.reviewerId},p),/disposable/);
  await h.db.query('UPDATE public.orders SET gross_sales=gross_sales+1 WHERE id=$1',[p.orders[0].id]);
  await assert.rejects(readStagingProfit(h,p.scopes[0]),/stale|evidence/i);
  await assert.rejects(executeStagingRehearsal(h,p,{mode:'commit-local'}),/changed/);
 }finally{await h.db.close();}
});

import {prepareStagingSqlProposal} from './staging-sql-proposal.mjs';
test('exported SQL is rollback only and roundtrips actual canonical schemas without residue',async()=>{
 const proposal=await prepareStagingSqlProposal(fixture,{reviewerId,from:options.from,to:options.to});
 assert.match(proposal.rollbackSql,/ROLLBACK;\s*$/);assert.doesNotMatch(proposal.rollbackSql,/\bCOMMIT\s*;|\bGRANT\b|CREATE\s+(TABLE|ROLE|POLICY)|ALTER\s+TABLE/i);
 const h=await createStagingRehearsal({reviewerId});try{
  const before=await stagingFingerprints(h.db);
  await h.db.exec(proposal.readOnlyPreflightSql);
  await h.db.query("SELECT set_config('night_scout.synthetic_target_verified','v2-isolated-staging-reviewed',false)");
  await h.db.exec(proposal.rollbackSql);
  assert.equal(await stagingFingerprints(h.db),before);
 }finally{await h.db.close();}
});
