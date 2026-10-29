import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {inspectShopifyWriterDatabase,writerPreflightOptions} from './shopify-database-preflight.mjs';

const env={NIGHT_SCOUT_TEST_PROGRAMME_ENABLED:'false',NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_TEST_PROGRAMME_TARGET:'pocketlaunchpad1.myshopify.com',NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL:'postgresql://night_scout_test_writer.bioalckltvkhlczusdvl:private-fixture@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',NODE_EXTRA_CA_CERTS:'/etc/secrets/supabase-root-2021.crt'};
const ca=`-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----\n`;
const restricted={rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,session_login:'night_scout_test_writer'};
function probe(options={}){
 const queries=[];let released=false;
 const client={async query(sql,params){
  queries.push({sql,params});
  if(sql==='ROLLBACK'&&options.rollbackFails)throw Error('private-fixture');
  if(sql.includes(' AS current_role'))return {rows:[{session_login:options.admin?'postgres':'night_scout_test_writer',current_role:'night_scout_test_writer',read_only:'on'}]};
  if(sql.includes('FROM pg_catalog.pg_roles'))return {rows:[{...restricted,rolname:'night_scout_test_writer',rolcanlogin:true,rolconnlimit:3},{...restricted,rolname:'night_scout_test_writer_service',rolcanlogin:false}]};
  if(sql.includes('FROM pg_catalog.pg_auth_members'))return {rows:[{role_name:'night_scout_test_writer_service',member_name:'night_scout_test_writer',admin_option:false,inherit_option:options.inherit??false,set_option:true}]};
  if(sql.includes('has_function_privilege'))return {rows:[{service_ready:true,service_underlying:options.bypass??false,login_underlying:false}]};
  if(sql.includes(' AS ready'))return {rows:[{ready:options.ready??false}]};
  return {rows:[]};
 },release(){released=true;if(options.releaseFails)throw Error('private-fixture');}};
 return {queries,get released(){return released;},run:()=>inspectShopifyWriterDatabase({env,readCa:()=>ca,connect:async connection=>{assert.equal(connection.ssl.rejectUnauthorized,true);return client;}})};
}

test('only the dedicated restricted credential and verified TLS are accepted before connecting',async()=>{
 const bad=[{NIGHT_SCOUT_TEST_PROGRAMME_ENABLED:'true'},{NIGHT_SCOUT_TEST_PROGRAMME_ENABLED:undefined},{NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:'wrong'},{NIGHT_SCOUT_TEST_PROGRAMME_TARGET:'merchant.myshopify.com'},{NODE_EXTRA_CA_CERTS:'/tmp/unknown.crt'},...['postgresql://postgres:private-fixture@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL+'?sslmode=disable',env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL.replace(':5432',':6543'),env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL.replace('aws-1-eu-west-1.pooler.supabase.com','example.com')].map(NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL=>({NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL}))];
 for(const change of bad){let connected=false;const result=await inspectShopifyWriterDatabase({env:{...env,...change},readCa:()=>ca,connect:async()=>{connected=true;throw Error();}});assert.equal(result.reason,'configuration_required');assert.equal(connected,false);assert.doesNotMatch(JSON.stringify(result),/private-fixture|postgresql/);}
 assert.equal(writerPreflightOptions(env,()=>ca).ssl.rejectUnauthorized,true);
 assert.throws(()=>writerPreflightOptions({...env,NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL:env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL.replace('postgresql:','postgres:')},()=>ca));
});

test('successful probe authenticates, checks ACLs, sets local role and rolls back without claiming',async()=>{
 const p=probe();const result=await p.run();
 assert.equal(result.state,'restricted_connection_verified');assert.equal(result.programmeWindowReady,false);assert.equal(result.activationVerified,false);assert.equal(result.providerWritesPerformed,false);
 assert.equal(p.queries[0].sql,'BEGIN READ ONLY');assert.equal(p.queries.at(-1).sql,'ROLLBACK');assert.equal(p.released,true);
 assert(p.queries.some(q=>q.sql==='SET LOCAL ROLE night_scout_test_writer_service'));
 assert(!p.queries.some(q=>/\b(INSERT|UPDATE|DELETE|claim_action\s*\()\b/.test(q.sql)));
});

test('an open window is evidence only, never activation or scheduled order proof',async()=>{
 const result=await probe({ready:true}).run();assert.equal(result.programmeWindowReady,true);assert.equal(result.activationVerified,false);assert.equal(result.providerWritesPerformed,false);
});

test('administrator session, inherited capability and bypass access fail closed before gate',async()=>{
 for(const options of [{admin:true},{inherit:true},{bypass:true}]){const p=probe(options);const r=await p.run();assert.equal(r.state,'unavailable');assert.equal(p.queries.at(-1).sql,'ROLLBACK');assert.equal(p.released,true);assert(!p.queries.some(q=>q.sql.includes(' AS ready')));}
});

test('connection, rollback and release errors expose no private error strings',async()=>{
 for(const options of [{rollbackFails:true},{releaseFails:true}]){const r=await probe(options).run();assert.equal(r.state,'unavailable');assert.doesNotMatch(JSON.stringify(r),/private-fixture/);}
 const r=await inspectShopifyWriterDatabase({env,readCa:()=>ca,connect:async()=>{throw Error(env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL);}});assert.equal(r.reason,'restricted_database_probe_failed');assert.doesNotMatch(JSON.stringify(r),/private-fixture|postgresql/);
});

test('real NOINHERIT login can resolve protected RPCs only after adopting the SET-only service role',async()=>{
 const db=new PGlite();let released=false;
 try{
  await db.exec(`
   CREATE ROLE night_scout_test_writer LOGIN NOINHERIT CONNECTION LIMIT 3;
   CREATE ROLE night_scout_test_writer_service NOLOGIN NOINHERIT;
   GRANT night_scout_test_writer_service TO night_scout_test_writer WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
   CREATE SCHEMA staging_test_programme;
   REVOKE ALL ON SCHEMA staging_test_programme FROM PUBLIC;
   GRANT USAGE ON SCHEMA staging_test_programme TO night_scout_test_writer_service;
   CREATE FUNCTION staging_test_programme.shopify_daily_20261029_ready(text,text,text,integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT false';
   CREATE FUNCTION staging_test_programme.claim_action_before_20261029(text,text,text,text,text,integer)
    RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT ''blocked''::text';
   REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION staging_test_programme.shopify_daily_20261029_ready(text,text,text,integer)
    TO night_scout_test_writer_service;
   SET SESSION AUTHORIZATION night_scout_test_writer;
  `);
  // Proves the authenticated login itself cannot resolve schema-qualified RPC
  // text. A pure query mock would miss this production PostgreSQL distinction.
  await assert.rejects(db.query("SELECT has_function_privilege('night_scout_test_writer_service','staging_test_programme.shopify_daily_20261029_ready(text,text,text,integer)','EXECUTE')"),/permission denied for schema/);
  const result=await inspectShopifyWriterDatabase({env,readCa:()=>ca,connect:async()=>({query:(...args)=>db.query(...args),release(){released=true;}})});
  assert.equal(result.state,'restricted_connection_verified');
  assert.equal(result.programmeWindowReady,false);
  assert.equal(result.activationVerified,false);
  assert.equal(released,true);
  const after=(await db.query('SELECT session_user::text AS login,current_user::text AS current_role')).rows[0];
  assert.deepEqual(after,{login:'night_scout_test_writer',current_role:'night_scout_test_writer'});
 }finally{await db.close();}
});
