import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,A} from '../shopify/finance-fixture.mjs';
import {recordShopifyCandidate} from '../shopify/record-candidate.mjs';
import {collectShopifyOrders} from '../shopify/collect.mjs';
import {loadShopifyDetails} from '../shopify/map-sales.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture} from '../shopify/fixtures.mjs';
const S='56d92f8a-746e-4b4f-b408-81fc98c4aa17';
const bundle=sql('proposals/shopify-intake-2026-09-17.sql');
async function fixture(){
 const {db}=await setup(); await db.exec(bundle);
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 data.settings.shopId='gid://shopify/Shop/95601983836';data.settings.domain='pocketlaunchpad1.myshopify.com';
 const scope={storeId:S,shopId:data.settings.shopId,from:'2026-02-01',to:'2026-02-28'};
 const restricted={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');return fn(tx);}),lockCandidateStore:(tx,id)=>tx.query('SELECT ingest_v1.lock_intake_store($1)',[id])};
 return {db,data,scope,restricted};
}
async function denied(db,query,args=[]){await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');await tx.query(query,args);}),/permission denied|row-level security|not authorised/);}
test('restricted role records then replays excluded test candidate, never financial evidence',async()=>{
 const {db,data,scope,restricted}=await fixture();try{
 data.orders[0].test=true;
 const first=await recordShopifyCandidate(restricted,data,scope),repeat=await recordShopifyCandidate(restricted,data,scope);
 assert.equal(first.status,'recorded_requires_review');assert.equal(repeat.status,'replay');assert.equal(first.batchId,repeat.batchId);
 const b=(await db.query('SELECT * FROM ingest_v1.batches WHERE store_id=$1',[S])).rows[0];assert.equal(b.coverage_certified,false);assert.equal(b.payload.mapped.excluded[0].reason,'TEST_ORDER');
 assert.equal((await db.query('SELECT count(*)::int n FROM public.orders WHERE store_id=$1',[S])).rows[0].n,0);
 }finally{await db.close();}
});
test('restricted role cannot mutate source, identity, certification or another store',async()=>{
 const {db}=await fixture();try{
 for(const q of ["UPDATE public.stores SET timezone='UTC' WHERE id=$1","DELETE FROM ingest_v1.batches WHERE store_id=$1","UPDATE ingest_v1.batches SET coverage_certified=true WHERE store_id=$1","DELETE FROM public.orders WHERE store_id=$1","INSERT INTO public.store_memberships(user_id,store_id) VALUES(gen_random_uuid(),$1)"])await denied(db,q,[S]);
 await denied(db,'SELECT ingest_v1.lock_intake_store($1)',[A]);
 await denied(db,"INSERT INTO ingest_v1.source_versions VALUES($1,'x',now(),repeat('a',64))",[A]);
 await db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');assert.deepEqual((await tx.query('SELECT id FROM public.stores')).rows,[{id:S}]);});
 }finally{await db.close();}
});
test('proposal atomic rollback and duplicate refusal',async()=>{
 const {db}=await setup();try{
 await assert.rejects(db.exec(bundle.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')),/division by zero/);await db.exec('ROLLBACK');
 assert.equal((await db.query('SELECT count(*)::int n FROM stores WHERE id=$1',[S])).rows[0].n,0);
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname='night_scout_intake_service'")).rows[0].n,0);
 await db.exec(bundle);await assert.rejects(db.exec(bundle),/already exists/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('changed source invalidates coverage and cross-store coverage is preserved; cannot certify',async()=>{
 const {db,data,scope,restricted}=await fixture();try{
 await recordShopifyCandidate(restricted,data,scope);
 await db.query("INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,'2026-02-01','2026-02-28','GBP',true,'synthetic-review','test')",[S]);
 const prior=(await db.query('SELECT to_jsonb(c) row FROM finance_v1.coverage_evidence c WHERE store_id=$1',[A])).rows;
 data.orders[0].updatedAt='2026-10-01T12:00:00Z';
 const changed=await recordShopifyCandidate(restricted,data,scope);assert.equal(changed.status,'changed_requires_review');
 assert.equal((await db.query('SELECT sales_and_refunds_complete FROM finance_v1.coverage_evidence WHERE store_id=$1',[S])).rows[0].sales_and_refunds_complete,false);
 assert.deepEqual((await db.query('SELECT to_jsonb(c) row FROM finance_v1.coverage_evidence c WHERE store_id=$1',[A])).rows,prior);
 await denied(db,'UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=true WHERE store_id=$1',[S]);
 await denied(db,'UPDATE ingest_v1.heads SET needs_recheck=false WHERE store_id=$1',[S]);
 await denied(db,"UPDATE finance_v1.coverage_evidence SET evidence_ref='forged' WHERE store_id=$1",[S]);
 for(const role of ['anon','authenticated'])await assert.rejects(db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);await tx.query('SELECT ingest_v1.lock_intake_store($1)',[S]);}),/permission denied/);
 }finally{await db.close();}
});
test('late recorder failure rolls back source versions and candidate batch',async()=>{
 const {db,data,scope,restricted}=await fixture();try{
 const faulty={...restricted,transaction:fn=>restricted.transaction(tx=>fn({query:(q,a)=>{if(q.startsWith('INSERT INTO ingest_v1.heads'))throw Error('late failure');return tx.query(q,a);}}))};
 await assert.rejects(recordShopifyCandidate(faulty,data,scope),/late failure/);
 for(const table of ['batches','heads','source_versions'])assert.equal((await db.query(`SELECT count(*)::int n FROM ingest_v1.${table} WHERE store_id=$1`,[S])).rows[0].n,0);
 }finally{await db.close();}
});
test('setup refuses disabled RLS before creating role or store',async()=>{
 const {db}=await setup();try{await db.exec('ALTER TABLE ingest_v1.batches DISABLE ROW LEVEL SECURITY');await assert.rejects(db.exec(bundle),/security is disabled/);await db.exec('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int n FROM stores WHERE id=$1',[S])).rows[0].n,0);}finally{await db.close();}
});
test('private login provisioner creates restricted login only and rejects repeat/project/password errors',async()=>{
 const {buildIntakeLoginSql}=await import('./intake-provision-login.mjs');
 const password='synthetic_'.repeat(6),projectRef='bioalckltvkhlczusdvl';
 for(const input of [{projectRef:'production',password},{projectRef,password:"unsafe'"}])assert.throws(()=>buildIntakeLoginSql(input),/Invalid staging/);
 const query=buildIntakeLoginSql({projectRef,password});assert.equal(query.includes(password),false);assert.match(query,/SCRAM-SHA-256/);
 const {db}=await fixture();try{
 await db.exec(query);
 const role=(await db.query("SELECT rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolconnlimit FROM pg_roles WHERE rolname='night_scout_intake_login'")).rows[0];assert.deepEqual(role,{rolcanlogin:true,rolinherit:false,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,rolconnlimit:2});
 assert.deepEqual((await db.query("SELECT r.rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE m.member=(SELECT oid FROM pg_roles WHERE rolname='night_scout_intake_login')")).rows,[{rolname:'night_scout_intake_service'}]);
 await assert.rejects(db.exec(query),/Unexpected intake baseline/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
