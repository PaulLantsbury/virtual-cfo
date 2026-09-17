import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,A} from './finance-fixture.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
import {recordCustomerIdentityObservations as record} from './customer-identity-writer.mjs';
const observation=()=>({identityCollectionVersion:1,storeId:target.storeId,shopId:target.shopId,shopifyOrderId:'gid://shopify/Order/1',shopifyCustomerId:'gid://shopify/Customer/10',sourceOrderUpdatedAt:'2026-09-17T12:00:00Z',observedAt:'2026-09-17T12:10:00Z'});
async function fixture(){const {db}=await setup();await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(sql('proposals/shopify-customer-identity-2026-09-17.sql'));const restricted={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');return fn(tx);})};return {db,restricted,close:()=>db.close()};}
const financialSnapshot=async db=>{const result={};for(const t of ['public.orders','public.refunds','ingest_v1.batches','ingest_v1.heads','ingest_v1.source_versions','finance_v1.coverage_evidence'])result[t]=(await db.query(`SELECT to_jsonb(r) row FROM ${t} r ORDER BY to_jsonb(r)::text`)).rows;return result;};
test('strict projected facts replay once; explicit null and changed/same-version conflicts retained without financial changes',async()=>{
 const f=await fixture();try{
 // Seed an existing synthetic financial payload/hash, so preservation is not an empty-table assertion.
 await f.db.query("INSERT INTO ingest_v1.batches(store_id,date_from,date_to,fingerprint,mapping_state,payload) VALUES($1,'2026-09-17','2026-09-17',$2,'blocked',$3::jsonb)",[target.storeId,'a'.repeat(64),JSON.stringify({source:{orders:[{id:'gid://shopify/Order/1',test:true}]},mapped:{status:'blocked',coverageCertified:false}})]);
 await f.db.query("INSERT INTO ingest_v1.source_versions VALUES($1,'gid://shopify/Order/1','2026-09-17T12:00:00Z',$2)",[target.storeId,'b'.repeat(64)]);
 const before=await financialSnapshot(f.db),o=observation();const first=await record(f.restricted,[o]);assert.equal(first.insertedCount,1);assert.equal(first.customerMetricsDerived,false);assert.equal(first.financialDataChanged,false);
 assert.equal((await record(f.restricted,[{...o,observedAt:'2026-09-17T13:00:00Z'}])).replayCount,1);
 assert.equal((await record(f.restricted,[{...o,shopifyCustomerId:null},{...o,shopifyCustomerId:'gid://shopify/Customer/11'},{...o,sourceOrderUpdatedAt:'2026-09-18T12:00:00Z'}])).insertedCount,3);
 assert.equal((await record(f.restricted,[{...o,shopifyCustomerId:null}])).replayCount,1);
 // A -> null -> A at the same source version retains conflicting facts, not a current identity.
 assert.equal((await record(f.restricted,[{...o,observedAt:'2026-09-17T14:00:00Z'}])).replayCount,1);
 const rows=(await f.db.query('SELECT * FROM shopify_identity_v1.order_observations')).rows;assert.equal(rows.length,4);assert.equal(rows.filter(r=>r.shopify_customer_id===null).length,1);assert.equal(new Date(rows.find(r=>r.shopify_customer_id===o.shopifyCustomerId&&new Date(r.source_order_updated_at).toISOString()==='2026-09-17T12:00:00.000Z').observed_at).toISOString(),'2026-09-17T12:10:00.000Z');
 assert.deepEqual(await financialSnapshot(f.db),before);assert.ok(!JSON.stringify(first).includes('Customer/'));assert.deepEqual(await record(f.restricted,[]),{status:'identity_observations_recorded',insertedCount:0,replayCount:0,financialDataChanged:false,customerMetricsDerived:false});
 }finally{await f.close();}
});
test('uncollected, malformed, foreign-scope or contact-bearing inputs rejected before transaction',async()=>{
 const db={transaction:()=>assert.fail('validation must precede transaction')},o=observation();const missing={...o};delete missing.shopifyCustomerId;
 for(const bad of [missing,{...o,shopifyCustomerId:undefined},{...o,email:'private@example.invalid'},{...o,storeId:A},{...o,shopId:'gid://shopify/Shop/2'},{...o,shopifyCustomerId:'gid://shopify/Order/10'},{...o,identityCollectionVersion:2},{...o,observedAt:'not-a-date'},{...o,observedAt:'2026-02-30T12:00:00Z'},{...o,sourceOrderUpdatedAt:'2026-09-17'}])await assert.rejects(record(db,[bad]),/Invalid customer/);
 await assert.rejects(record(db,Array(1001).fill(o)),/Invalid/);
});
test('identity rows cannot be edited/deleted/read by browsers or inserted across stores; recording grants expose no new finance writes',async()=>{
 const f=await fixture();try{
 await record(f.restricted,[observation()]);
 for(const q of ['UPDATE shopify_identity_v1.order_observations SET shopify_customer_id=null','DELETE FROM shopify_identity_v1.order_observations','TRUNCATE shopify_identity_v1.order_observations',"UPDATE public.orders SET customer_id=null"])await assert.rejects(f.restricted.transaction(tx=>tx.query(q)),/permission/);
 await assert.rejects(f.restricted.transaction(tx=>tx.query("INSERT INTO shopify_identity_v1.order_observations(identity_collection_version,store_id,shop_id,shopify_order_id,shopify_customer_id,source_order_updated_at,observed_at) VALUES(1,$1,$2,'gid://shopify/Order/1',null,now(),now())",[A,target.shopId])),/row-level security/);
 for(const role of ['anon','authenticated'])await assert.rejects(f.db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);await tx.query('SELECT * FROM shopify_identity_v1.order_observations');}),/permission/);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM shopify_identity_v1.order_observations')).rows[0].n,1);
 }finally{await f.close();}
});
test('late transaction failure rolls back whole observation batch; lost commit acknowledgement retains idempotent facts',async()=>{
 const f=await fixture();try{
 const o=observation(),second={...o,shopifyOrderId:'gid://shopify/Order/2'};
 const failing={transaction:fn=>f.restricted.transaction(async tx=>{await fn(tx);throw Error('private database detail');})};
 await assert.rejects(record(failing,[o,second]),e=>e.message.includes('unconfirmed')&&!e.message.includes('private'));assert.equal((await f.db.query('SELECT count(*)::int n FROM shopify_identity_v1.order_observations')).rows[0].n,0);
 const uncertain={transaction:async fn=>{await f.restricted.transaction(fn);throw Error('lost commit acknowledgement');}};await assert.rejects(record(uncertain,[o,second]),/unconfirmed/);
 assert.equal((await record(f.restricted,[o,second])).replayCount,2);assert.equal((await f.db.query('SELECT count(*)::int n FROM shopify_identity_v1.order_observations')).rows[0].n,2);
 }finally{await f.close();}
});
test('staging identity mismatch blocks proposal and writer without partially recording observations',async()=>{
 const f=await fixture();try{await f.db.query("UPDATE stores SET timezone='UTC' WHERE id=$1",[target.storeId]);await assert.rejects(record(f.restricted,[observation()]),/unconfirmed/);assert.equal((await f.db.query('SELECT count(*)::int n FROM shopify_identity_v1.order_observations')).rows[0].n,0);}finally{await f.close();}
 const {db}=await setup();try{await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.query("UPDATE stores SET shopify_store_id='999' WHERE id=$1",[target.storeId]);await assert.rejects(db.exec(sql('proposals/shopify-customer-identity-2026-09-17.sql')));await db.exec('ROLLBACK');assert.equal((await db.query("SELECT to_regnamespace('shopify_identity_v1') n")).rows[0].n,null);}finally{await db.close();}
});
