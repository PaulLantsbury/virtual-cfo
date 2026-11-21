// Dependency-injected local reader tests: fake Auth responder and transaction spy.
// These prove control flow/contracts, not hosted JWT validation or effective RLS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomerSidecarService} from './customer-sidecar-reader.mjs';
import {supplementalDigest} from './supplemental-reader.mjs';
import {reviewedBrowserMonth} from '../../artifacts/virtual-cfo/tests/reviewed-pages.test-fixture.ts';
const uid='60000000-0000-4000-8000-000000000001',bid='70000000-0000-4000-8000-000000000001',vid='80000000-0000-4000-8000-000000000001';
const clock=()=>new Date('2026-11-21T12:00:00Z');
function fixture(){
 const f=structuredClone(reviewedBrowserMonth('2025-03-01',2));f.response.versionId=f.response.snapshotId=f.response.metadata.versionId=vid;f.acquisition.financial.snapshotId=vid;
 const activity=f.acquisition.customerActivity;delete f.acquisition.customerActivity;
 const scope=f.response.scope,selection={edition:f.response.metadata.edition,versionId:vid};
 const body={contract:'reviewed-supplement-v1',kind:'acquisition',scope:structuredClone(f.acquisition.scope),financialVersionId:vid,salesRevision:f.response.salesRevision,costRevision:f.response.costRevision,sourceBasis:'synthetic-local',observedAt:'2026-11-20T12:00:00Z',payload:f.acquisition};
 const base={snapshot_id:bid,store_id:scope.storeId,scope_from:scope.from,scope_to:scope.to,kind:'acquisition',financial_version:vid,sales_revision:body.salesRevision,cost_revision:body.costRevision,body,body_hash:supplementalDigest(body),observed_at:new Date(body.observedAt),invalidated:false};
 const sideBody={contract:'synthetic-customer-summary-sidecar-v1',baseBodyHash:base.body_hash,scope:structuredClone(body.scope),financialVersionId:vid,salesRevision:body.salesRevision,costRevision:body.costRevision,activity};
 const version=supplementalDigest(sideBody);
 const row={version_id:version,base_snapshot_id:bid,base_body_hash:base.body_hash,store_id:scope.storeId,financial_version:vid,scope_from:scope.from,scope_to:scope.to,sales_revision:body.salesRevision,cost_revision:body.costRevision,body:sideBody,selected_by:uid,selected_at:new Date('2026-11-21T10:00:00Z'),selected_base_snapshot_id:bid,selected_version_id:version};
 const request={financialSelection:selection,baseSnapshotId:bid,sidecarVersionId:version};
 const calls=[],authCalls=[];let member=true,authValid=true,bases=[base],rows=[row],withdrawals=[],failQuery=false;
 const tx={exec:async sql=>calls.push({sql}),query:async(sql,args)=>{calls.push({sql,args});if(sql.includes('set_config'))return {rows:[{}]};if(sql.includes('store_memberships'))return {rows:member?[{store_id:scope.storeId}]:[]};if(failQuery)throw Error('SECRET SQL/customer/token');if(sql.includes('finance_review_supplement_v1.snapshots'))return {rows:bases};if(sql.includes('finance_customer_sidecar_v1.selections'))return {rows};if(sql.includes('finance_customer_sidecar_v1.withdrawals'))return {rows:withdrawals};throw Error('Unexpected fixture query');}};
 const db={transaction:async fn=>{calls.push({transaction:true});return fn(tx);}};
 const supabase={auth:{getUser:async token=>{authCalls.push(token);return authValid?{data:{user:{id:uid,is_anonymous:false}}}:{error:Error('SECRET token'),data:{user:null}};}}};
 const options={now:clock,readHistory:async(gotTx,gotScope,opts)=>{calls.push({canonical:true});assert.equal(gotTx,tx);assert.deepEqual(gotScope,scope);assert.deepEqual(opts.selection,selection);assert.equal(+opts.now(),+clock());return structuredClone(f.response);}};
 const service=createCustomerSidecarService(db,supabase,options),run=()=>service.read(scope,'Bearer fictional',request);
 return {run,service,scope,request,options,db,supabase,calls,authCalls,base,row,financial:f.response,setMember:v=>member=v,setAuth:v=>authValid=v,setBases:v=>bases=v,setRows:v=>rows=v,setFailure:v=>failQuery=v,setWithdrawals:v=>withdrawals=v,rehash(){row.version_id=supplementalDigest(row.body);row.selected_version_id=row.version_id;request.sidecarVersionId=row.version_id;}};
}
test('explicit selected activity is returned only after fresh Auth/member/canonical/base checks in one readonly transaction',async()=>{
 const h=fixture(),before=JSON.stringify(h.base),r=await h.run();assert.equal(r.state,'supported');assert.deepEqual(r.activity,h.row.body.activity);assert.equal(h.authCalls.length,1);
 assert.equal(h.calls[1].sql,'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');assert.deepEqual(h.calls[2].args,[uid]);assert.match(h.calls[3].sql,/store_memberships/);assert.equal(h.calls[4].canonical,true);
 const select=h.calls.find(c=>c.sql?.includes('finance_customer_sidecar_v1.selections'));assert.deepEqual(select.args,[bid,h.request.sidecarVersionId]);assert.ok(!/ORDER BY|MAX\(|DESC/.test(select.sql));assert.ok(h.calls.filter(c=>c.sql).every(c=>!/INSERT|UPDATE|DELETE|GRANT|CREATE|ALTER/.test(c.sql)));
 r.activity.identifiedCustomers=999;assert.notEqual(h.row.body.activity.identifiedCustomers,999);assert.equal(JSON.stringify(h.base),before);for(const secret of ['selected_by','costSourceHash','economics','source_manifest','netProductSales','SECRET'])assert.ok(!JSON.stringify(r).includes(secret),secret);
});
test('Auth and membership are verified every call; denial precedes all canonical/private evidence access',async()=>{
 const h=fixture();await assert.rejects(h.service.read(h.scope,'',h.request),/sign-in/);assert.equal(h.calls.length,0);h.setAuth(false);await assert.rejects(h.run(),/verified/);assert.equal(h.calls.length,0);
 h.setAuth(true);h.setMember(false);await assert.rejects(h.run(),/membership/);assert.equal(h.calls.some(c=>c.canonical),false);assert.equal(h.calls.some(c=>c.sql?.includes('snapshots')),false);
 h.setMember(true);assert.equal((await h.run()).state,'supported');h.setMember(false);await assert.rejects(h.run(),/membership/);assert.equal(h.authCalls.length,4);
});
test('broader scope, nonreserved company, malformed/hashless/identity-bearing requests fail before Auth',async()=>{
 for(const change of [h=>h.scope.extra=true,h=>h.scope.storeId=uid,h=>h.request.sidecarVersionId=vid,h=>h.request.baseSnapshotId='bad',h=>h.request.reviewerId=uid,h=>h.request.financialSelection.userId=uid,h=>h.request.financialSelection.edition='other']){const h=fixture();change(h);await assert.rejects(h.run(),/selection/);assert.equal(h.authCalls.length,0);}
 const h=fixture();let touched=false;Object.defineProperty(h.request,'bad',{enumerable:true,get(){touched=true;return 1;}});await assert.rejects(h.run(),/selection/);assert.equal(touched,false);assert.equal(h.authCalls.length,0);
});
test('current canonical invalidation/correction, ambiguous/missing base or explicit selection never fallback',async()=>{
 for(const change of [h=>h.financial.state='unavailable',h=>h.financial.versionId=bid,h=>h.financial.costRevision='f'.repeat(64),h=>h.financial.salesRevision='f'.repeat(64),h=>h.setBases([]),h=>h.setBases([h.base,h.base]),h=>h.base.invalidated=true,h=>h.setRows([]),h=>h.setRows([h.row,h.row]),h=>h.row.selected_version_id='f'.repeat(64),h=>h.row.selected_base_snapshot_id=uid]){const h=fixture();change(h);assert.equal((await h.run()).state,'unavailable');}
});
test('index/body/hash/scope/customer unions must all agree; rehashing cannot bypass structural bindings',async()=>{
 for(const change of [h=>h.base.body.payload.coverage.guestOrders++,h=>h.base.body_hash='f'.repeat(64),h=>h.row.base_body_hash='f'.repeat(64),h=>h.row.sales_revision='f'.repeat(64),h=>h.row.scope_from='2025-02-01',h=>h.row.body.scope.currency='EUR',h=>h.row.body.financialVersionId=bid,h=>h.row.body.activity.identifiedCustomers=99,h=>h.row.body.activity.uniqueReturningCustomers=0,h=>h.row.body.activity.sourceHash='f'.repeat(64),h=>h.row.body.extra='SECRET']){const h=fixture();change(h);h.rehash();assert.equal((await h.run()).state,'unavailable');}
});
test('future/pre-base selection timestamps and private errors release no details',async()=>{
 for(const stamp of ['2099-01-01T00:00:00Z','2026-11-19T00:00:00Z','invalid']){const h=fixture();h.row.selected_at=stamp;assert.equal((await h.run()).state,'unavailable');}
 const h=fixture();h.setFailure(true);const r=await h.run();assert.equal(r.state,'unavailable');assert.ok(!JSON.stringify(r).includes('SECRET'));
});
test('unselected but present version cannot be loaded or auto-selected, even on a cached previous success',async()=>{
 const h=fixture();assert.equal((await h.run()).state,'supported');h.setRows([]);assert.equal((await h.run()).state,'unavailable');h.setRows([h.row]);h.request.sidecarVersionId='a'.repeat(64);assert.equal((await h.run()).state,'unavailable');
});

test('transaction infrastructure failure is redacted instead of leaking SQL or operator details',async()=>{const h=fixture(),service=createCustomerSidecarService({transaction:async()=>{throw Error('SECRET operator connection');}},h.supabase,h.options);const result=await service.read(h.scope,'Bearer fictional',h.request);assert.equal(result.state,'unavailable');assert.ok(!JSON.stringify(result).includes('SECRET'));});

test('withdrawn archived selection is unavailable with no previous-success or alternate-version fallback',async()=>{const h=fixture();assert.equal((await h.run()).state,'supported');h.setWithdrawals([{base_snapshot_id:bid,version_id:h.request.sidecarVersionId}]);const result=await h.run();assert.equal(result.state,'unavailable');assert.equal(result.activity,undefined);const checks=h.calls.filter(c=>c.sql?.includes('finance_customer_sidecar_v1.withdrawals'));assert.equal(checks.length,2);assert.ok(checks.every(c=>JSON.stringify(c.args)===JSON.stringify([bid])));});
