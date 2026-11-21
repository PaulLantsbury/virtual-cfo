import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const owner='10000000-0000-4000-8000-000000000001',store='56d92f8a-746e-4b4f-b408-81fc98c4aa17',connection='30000000-0000-4000-8000-000000000001';
const session='a'.repeat(64),state='b'.repeat(64);
export async function fixture({beforeInstall}={}){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE ROLE night_scout_xero_bootstrap_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD NULL;CREATE ROLE night_scout_import_login NOLOGIN;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));`);
 await db.exec(sql('db-migrations/staging/20260918_apply_xero_staging.sql'));
 await db.exec(`INSERT INTO auth.users VALUES('${owner}');INSERT INTO public.stores VALUES('${store}');INSERT INTO public.store_memberships VALUES('${owner}','${store}');INSERT INTO xero_v1.connections(id,store_id,tenant_id) VALUES('${connection}','${store}','synthetic');INSERT INTO xero_v1.mapping_versions(id,connection_id,version,effective_from,confirmed_by,confirmed_at,directory_retrieved_at) VALUES('40000000-0000-4000-8000-000000000001','${connection}',1,'2026-09-01','${owner}',now(),now());INSERT INTO xero_v1.credential_envelopes(connection_id,ciphertext,encrypted_dek,key_version,algorithm,version) VALUES('${connection}',decode('01','hex'),decode('02','hex'),'test-key','AES-256-GCM',7);CREATE TABLE xero_v1.xero_sixth_reauthorization_authorizations(id integer,consumed_at timestamptz);INSERT INTO xero_v1.xero_sixth_reauthorization_authorizations VALUES(1,now());`);
 if(beforeInstall) await db.exec(beforeInstall);
 await db.exec(sql('db-migrations/proposals/xero-durable-reconnect-2026-10-15.sql'));
 return db;
}
async function role(db){await db.exec('SET SESSION AUTHORIZATION night_scout_xero_bootstrap_login');}
async function admin(db,patch){await db.exec('SET SESSION AUTHORIZATION postgres');await db.exec(patch);await role(db);}
async function begin(db,over=[]){return (await db.query('SELECT * FROM xero_v1.customer_reconnect_begin($1,$2,$3,$4,$5)',[store,owner,session,state,'read-only-v1'].map((x,i)=>over[i]??x))).rows[0];}
async function claim(db,a,over=[]){return (await db.query('SELECT * FROM xero_v1.customer_reconnect_claim($1,$2,$3,$4,$5)',[a.attempt_id,store,owner,session,state].map((x,i)=>over[i]??x))).rows[0];}
async function finalize(db,a,c,over=[]){return (await db.query('SELECT * FROM xero_v1.customer_reconnect_finalize($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[a.attempt_id,c.exchange_claim,store,owner,session,'synthetic','read-only-v1',new Uint8Array([3]),new Uint8Array([4]),'test-key','AES-256-GCM',connection,7].map((x,i)=>over[i]??x))).rows[0];}
async function record(db){await db.exec('SET SESSION AUTHORIZATION postgres');const r=(await db.query(`SELECT (SELECT version FROM xero_v1.credential_envelopes) version,(SELECT encode(ciphertext,'hex') FROM xero_v1.credential_envelopes) ciphertext,(SELECT jsonb_agg(a ORDER BY id) FROM xero_v1.customer_reconnect_attempts a) attempts,(SELECT count(*) FROM xero_v1.credential_audit) audits,(SELECT jsonb_agg(m) FROM xero_v1.mapping_versions m) mappings,(SELECT jsonb_agg(h) FROM xero_v1.xero_sixth_reauthorization_authorizations h) history`)).rows[0];await role(db);return r;}
test('durable begin claim finalize preserves histories, consumes once and denies direct/browser grants',async()=>{const db=await fixture();try{
 await role(db);const before=await record(db),a=await begin(db);assert.equal(a.credential_version,7);assert.equal(a.tenant_id,'synthetic');
 await assert.rejects(begin(db));const c=await claim(db,a);await assert.rejects(claim(db,a));const result=await finalize(db,a,c);assert.equal(result.credential_version,8);await assert.rejects(finalize(db,a,c));
 const after=await record(db);assert.deepEqual(after.mappings,before.mappings);assert.deepEqual(after.history,before.history);assert.equal(after.attempts[0].status,'consumed');assert.equal(after.audits,1);
 await assert.rejects(db.query('SELECT * FROM xero_v1.customer_reconnect_attempts'),e=>e.code==='42501');
 await db.exec('SET SESSION AUTHORIZATION postgres');for(const role of ['anon','authenticated','service_role','night_scout_import_login']){
  await db.exec(`SET SESSION AUTHORIZATION ${role}`);await assert.rejects(begin(db),e=>e.code==='42501');await db.exec('SET SESSION AUTHORIZATION postgres');
 }
}finally{await db.close();}});
for(const [name,patch] of [
 ['membership revoked',`DELETE FROM public.store_memberships`],
 ['owner changed',`INSERT INTO auth.users VALUES('10000000-0000-4000-8000-000000000002');UPDATE xero_v1.mapping_versions SET confirmed_by='10000000-0000-4000-8000-000000000002'`],
 ['refresh version race','UPDATE xero_v1.credential_envelopes SET version=8'],
 ['refresh active lease',"UPDATE xero_v1.credential_envelopes SET lease_expires_at=now()+interval '5 minutes'"],
 ['retired connection','UPDATE xero_v1.connections SET retired_at=now()'],
 ['expired attempt',"UPDATE xero_v1.customer_reconnect_attempts SET created_at=now()-interval '12 minutes',expires_at=now()-interval '2 minutes'"],
 ['tenant changed',"UPDATE xero_v1.connections SET tenant_id='changed'"],
])test(`finalize refuses ${name} without partial writes`,async()=>{const db=await fixture();try{await role(db);const a=await begin(db),c=await claim(db,a);await admin(db,patch);const before=await record(db);await assert.rejects(finalize(db,a,c));assert.deepEqual(await record(db),before);}finally{await db.close();}});
test('proof boundaries reject cross-store/session/state/claim/tenant/scope and malformed envelopes',async()=>{const db=await fixture();try{
 await role(db);const a=await begin(db);
 for(const over of [[undefined,'00000000-0000-4000-8000-000000000001'],[undefined,undefined,undefined,'c'.repeat(64)],[undefined,undefined,undefined,undefined,'c'.repeat(64)]])await assert.rejects(claim(db,a,over));
 const c=await claim(db,a);for(const over of [[undefined,'00000000-0000-4000-8000-000000000001'],[undefined,undefined,undefined,undefined,'c'.repeat(64)],[undefined,undefined,undefined,undefined,undefined,'wrong'],[undefined,undefined,undefined,undefined,undefined,undefined,'write'],[undefined,undefined,undefined,undefined,undefined,undefined,undefined,new Uint8Array([])]])await assert.rejects(finalize(db,a,c,over));
 assert.equal((await record(db)).version,7);
}finally{await db.close();}});
test('audit insertion failure rolls back credential rotation and consumption together',async()=>{const db=await fixture();try{
 await role(db);const a=await begin(db),c=await claim(db,a);await admin(db,`CREATE FUNCTION xero_v1.reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic audit failure';END$$;CREATE TRIGGER reject_test_audit BEFORE INSERT ON xero_v1.credential_audit FOR EACH ROW EXECUTE FUNCTION xero_v1.reject_test_audit();`);
 const before=await record(db);await assert.rejects(finalize(db,a,c),/synthetic audit failure/);assert.deepEqual(await record(db),before);
}finally{await db.close();}});
test('uncertain exchange is failed idempotently and cannot later finalize or reuse state',async()=>{const db=await fixture();try{
 await role(db);const a=await begin(db),c=await claim(db,a);const fail=()=>db.query('SELECT * FROM xero_v1.customer_reconnect_fail($1,$2,$3,$4,$5)',[a.attempt_id,c.exchange_claim,store,owner,session]);await fail();await fail();await assert.rejects(finalize(db,a,c));await assert.rejects(begin(db));
 const fresh=await begin(db,[undefined,undefined,undefined,'c'.repeat(64)]);assert.notEqual(fresh.attempt_id,a.attempt_id);
}finally{await db.close();}});
test('simultaneous client calls serialize to exactly one exchange claim in embedded database',async()=>{const db=await fixture();try{
 await role(db);const a=await begin(db);const results=await Promise.allSettled([claim(db,a),claim(db,a)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 // PGlite serializes requests: this is not independent PostgreSQL backend lock testing.
}finally{await db.close();}});

test('expired abandoned exchange permits fresh consent but never permits old finalization',async()=>{const db=await fixture();try{
 await role(db);const a=await begin(db),c=await claim(db,a);await admin(db,"UPDATE xero_v1.customer_reconnect_attempts SET created_at=now()-interval '12 minutes',expires_at=now()-interval '2 minutes'");
 const fresh=await begin(db,[undefined,undefined,undefined,'c'.repeat(64)]);assert.notEqual(a.attempt_id,fresh.attempt_id);await assert.rejects(finalize(db,a,c));assert.equal((await record(db)).attempts.find(x=>x.id===a.attempt_id).status,'expired');
}finally{await db.close();}});

test('finalize rejects sealed envelope connection or credential version mismatch before any mutation',async()=>{const db=await fixture();try{
 await role(db);const a=await begin(db),c=await claim(db,a);const before=await record(db);
 const wrongConnection=Array(13);wrongConnection[11]='30000000-0000-4000-8000-000000000002';
 const wrongVersion=Array(13);wrongVersion[12]=6;
 for(const over of [wrongConnection,wrongVersion]){await assert.rejects(finalize(db,a,c,over));assert.deepEqual(await record(db),before);}
 assert.equal((await finalize(db,a,c)).credential_version,8);
}finally{await db.close();}});
