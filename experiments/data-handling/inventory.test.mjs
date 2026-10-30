import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {INVENTORY_TARGET as target,inventoryDataHandling,catalogQuery} from './inventory.mjs';
const other='90000000-0000-4000-8000-000000000002';
async function fixture(){
 const db=new PGlite(),queries=[];
 await db.exec(`CREATE TABLE public.stores(id uuid,shopify_domain text,shopify_store_id text,currency_code text,timezone text);
 CREATE TABLE public.customers(store_id uuid,email text,first_name text);
 CREATE TABLE public.orders(store_id uuid,shopify_order_id text);
 CREATE TABLE public.store_memberships(store_id uuid,user_id uuid);
 CREATE SCHEMA ingest_v1;CREATE TABLE ingest_v1.batches(store_id uuid,payload jsonb);
 CREATE TABLE ingest_v1.review_audit(store_id uuid,review_snapshot jsonb);
 CREATE FUNCTION ingest_v1.immutable_review() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit immutable'; END$$;
 CREATE TRIGGER immutable_review BEFORE DELETE ON ingest_v1.review_audit FOR EACH ROW EXECUTE FUNCTION ingest_v1.immutable_review();
 CREATE SCHEMA shopify_identity_v1;CREATE TABLE shopify_identity_v1.order_observations(store_id uuid,shopify_customer_id text);
 CREATE SCHEMA xero_v1;CREATE TABLE xero_v1.connections(id uuid,store_id uuid);
 CREATE TABLE xero_v1.credential_envelopes(connection_id uuid,ciphertext text);
 CREATE TABLE xero_v1.accounting_evidence(connection_id uuid,amount bigint);
 CREATE TABLE xero_v1.unclassified_copy(secret text);
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid,email text);CREATE TABLE auth.sessions(user_id uuid,session_secret text);`);
 await db.query("INSERT INTO public.stores VALUES($1,'pocketlaunchpad1.myshopify.com','95601983836','GBP','Europe/London'),($2,'other.myshopify.com','other','GBP','UTC')",[target.storeId,other]);
 await db.query("INSERT INTO public.customers VALUES($1,'SENSITIVE_EMAIL','SENSITIVE_NAME'),($2,'OTHER_EMAIL','OTHER_NAME')",[target.storeId,other]);
 await db.query("INSERT INTO public.orders VALUES($1,'SENSITIVE_ORDER'),($2,'OTHER_ORDER')",[target.storeId,other]);
 await db.query("INSERT INTO ingest_v1.batches VALUES($1,$2)",[target.storeId,JSON.stringify({customer:'SENSITIVE_PAYLOAD'})]);
 await db.query("INSERT INTO ingest_v1.review_audit VALUES($1,$2)",[target.storeId,JSON.stringify({snapshot:'SENSITIVE_REVIEW'})]);
 await db.query("INSERT INTO shopify_identity_v1.order_observations VALUES($1,'SENSITIVE_CUSTOMER_ID')",[target.storeId]);
 await db.query('INSERT INTO xero_v1.connections VALUES($1,$2),($3,$4)',['10000000-0000-4000-8000-000000000001',target.storeId,'10000000-0000-4000-8000-000000000002',other]);
 await db.exec("INSERT INTO xero_v1.credential_envelopes VALUES('10000000-0000-4000-8000-000000000001','SENSITIVE_CIPHERTEXT'),('10000000-0000-4000-8000-000000000002','OTHER_CIPHERTEXT')");
 const client={query:async(sql,args)=>{queries.push(sql);return db.query(sql,args);}};
 return {db,queries,client,run:()=>inventoryDataHandling(client,target),close:()=>db.close()};
}
const relation=(report,name)=>report.relations.find(r=>r.relation===name);

test('counts are store-scoped, source/identity/audit/envelope values never enter aggregate report',async()=>{
 const f=await fixture();try{
  const report=await f.run();
  for(const name of ['public.customers','public.orders','ingest_v1.batches','ingest_v1.review_audit','shopify_identity_v1.order_observations','xero_v1.credential_envelopes'])assert.equal(relation(report,name).visibleRowCount,1);
  assert.equal(report.unclassifiedRelationCount,1);
  assert.equal(relation(report,'ingest_v1.review_audit').deleteGuardTriggerCount,1);
  assert.doesNotMatch(JSON.stringify(report),/SENSITIVE_|OTHER_|10000000-0000|56d92f8a|ciphertext|review_snapshot/);
  assert.equal(report.backupsVerified,false);assert.equal(report.disconnectVerified,false);assert.equal(report.providerRevocationVerified,false);
  assert.equal(report.coverage,'visible_rows_only_not_a_complete_erasure_manifest');
  assert.equal(f.queries[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.at(-1),'ROLLBACK');
  assert.equal(f.queries.some(q=>/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|COMMIT|TRUNCATE)\b/i.test(q)),false);
 }finally{await f.close();}
});

test('missing proposed tables and empty installed tables remain distinct; neither establishes deletion readiness',async()=>{
 const f=await fixture();try{
  const report=await f.run();
  assert.equal(relation(report,'finance_v1.line_cost_evidence').state,'relation_absent');
  assert.equal(relation(report,'finance_v1.line_cost_evidence').visibleRowCount,null);
  assert.equal(relation(report,'xero_v1.accounting_evidence').state,'counted');
  assert.equal(relation(report,'xero_v1.accounting_evidence').visibleRowCount,0);
  assert.equal(report.deletionImplementedByThisTool,false);
  assert.equal(report.retentionPeriods,'not_decided_by_this_tool');
 }finally{await f.close();}
});

test('unreadable and unsupported relations are not reported as zero',async()=>{
 const f=await fixture();try{
  const client={query:async(q,args)=>{
   const result=await f.db.query(q,args);
   if(q===catalogQuery)for(const row of result.rows){if(row.table_name==='customers')row.readable=false;if(row.table_name==='orders')row.columns=[];}
   return result;
  }};
  const report=await inventoryDataHandling(client,target);
  assert.equal(relation(report,'public.customers').state,'unreadable');assert.equal(relation(report,'public.customers').visibleRowCount,null);
  assert.equal(relation(report,'public.orders').state,'unsupported_shape');assert.equal(relation(report,'public.orders').visibleRowCount,null);
 }finally{await f.close();}
});

test('per-relation failure rolls back savepoint, remains private and allows independent counts',async()=>{
 const f=await fixture();try{
  const client={query:async(q,args)=>{f.queries.push(q);if(q.startsWith('SELECT count(*)::text row_count FROM public.customers'))throw Error('postgres://SENSITIVE_PASSWORD@private');return f.db.query(q,args);}};
  const report=await inventoryDataHandling(client,target);
  assert.equal(relation(report,'public.customers').state,'count_unavailable');assert.equal(relation(report,'public.orders').visibleRowCount,1);
  assert.ok(f.queries.includes('ROLLBACK TO SAVEPOINT inventory_relation'));
  assert.doesNotMatch(JSON.stringify(report),/SENSITIVE_PASSWORD|private/);
 }finally{await f.close();}
});

test('wrong project/store is rejected before any query; invisible/wrong configured target is unavailable',async()=>{
 let queried=false;const client={query:async()=>{queried=true;}};
 for(const value of [{...target,projectRef:'wrong'},{...target,storeId:other},{}])await assert.rejects(inventoryDataHandling(client,value),/inventory unavailable/);
 assert.equal(queried,false);
 const f=await fixture();try{
  await f.db.query("UPDATE public.stores SET currency_code='EUR' WHERE id=$1",[target.storeId]);
  await assert.rejects(f.run(),/inventory unavailable/);assert.equal(f.queries.at(-1),'ROLLBACK');
 }finally{await f.close();}
});

test('row-level filtering remains explicitly limited visibility, not proof of complete erasure',async()=>{
 const f=await fixture();try{
  await f.db.exec(`CREATE ROLE inventory_limited NOLOGIN;GRANT USAGE ON SCHEMA public TO inventory_limited;
   GRANT SELECT ON public.stores,public.customers TO inventory_limited;
   ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;CREATE POLICY no_customer_rows ON public.customers USING(false);SET ROLE inventory_limited;`);
  const report=await f.run();
  assert.equal(relation(report,'public.customers').visibleRowCount,0);
  assert.equal(relation(report,'public.customers').visibility,'current_role_visible_only');
  assert.equal(report.deletionImplementedByThisTool,false);
  await f.db.exec('RESET ROLE');assert.equal((await f.db.query('SELECT count(*)::int n FROM public.customers')).rows[0].n,2);
 }finally{await f.close();}
});
