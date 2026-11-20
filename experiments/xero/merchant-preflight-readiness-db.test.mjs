import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../../db-migrations/proposals/xero-merchant-preflight-readiness-2026-10-09.sql',import.meta.url),'utf8');
const owner='10000000-0000-4000-8000-000000000001',store='20000000-0000-4000-8000-000000000001',connection='30000000-0000-4000-8000-000000000001';
async function fixture(){const db=new PGlite();await db.exec(`
 CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE SCHEMA auth;CREATE SCHEMA xero_v1;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);
 CREATE TABLE xero_v1.connections(id uuid,store_id uuid,created_at timestamptz,retired_at timestamptz);
 CREATE TABLE xero_v1.mapping_versions(id uuid,connection_id uuid,version integer,confirmed_at timestamptz);
 CREATE TABLE xero_v1.mapping_audit(connection_id uuid,action text,occurred_at timestamptz);
 CREATE TABLE xero_v1.credential_envelopes(connection_id uuid,version integer);
 CREATE TABLE xero_v1.xero_reauthorization_authorizations(connection_id uuid,consumed_at timestamptz);
 CREATE TABLE xero_v1.accounting_evidence(connection_id uuid,state text,retrieved_at timestamptz,created_at timestamptz);
 CREATE TABLE xero_v1.connection_preflight_evidence(id uuid DEFAULT gen_random_uuid(),connection_id uuid,credential_version integer,outcome text,reason text,checked_at timestamptz);
 CREATE FUNCTION public.xero_merchant_readiness(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 REVOKE ALL ON FUNCTION public.xero_merchant_readiness(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.xero_merchant_readiness(uuid) TO authenticated;
 INSERT INTO public.store_memberships VALUES('${owner}','${store}');
 INSERT INTO xero_v1.connections VALUES('${connection}','${store}','2026-09-01',NULL);
 INSERT INTO xero_v1.mapping_versions VALUES(gen_random_uuid(),'${connection}',1,'2026-09-01');
 INSERT INTO xero_v1.credential_envelopes VALUES('${connection}',3);
 INSERT INTO xero_v1.accounting_evidence VALUES('${connection}','supported','2026-10-09T12:00Z','2026-10-09T12:00Z');
 `);await db.exec(migration);return db;}
async function read(db,user=owner,target=store){await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('SET ROLE authenticated');try{return (await db.query('SELECT public.xero_merchant_readiness($1) value',[target])).rows[0].value;}finally{await db.exec('RESET ROLE');}}
async function receipt(db,version,outcome,reason,time){await db.query('INSERT INTO xero_v1.connection_preflight_evidence(connection_id,credential_version,outcome,reason,checked_at) VALUES($1,$2,$3,$4,$5)',[connection,version,outcome,reason,time]);}
test('latest current credential preflight overrides saved envelope and retains snapshot date',async()=>{const db=await fixture();try{
 assert.equal((await read(db)).connection.status,'active');
 await receipt(db,3,'failed','reconnect_required','2026-10-09T13:00Z');const failed=await read(db);
 assert.equal(failed.connection.status,'reauthorization_required');assert.equal(failed.evidenceState,'review_required');assert.equal(failed.evidenceRetrievedAt,'2026-10-09T12:00:00.000Z');
 assert.doesNotMatch(JSON.stringify(failed),/credential_version|tenant|ciphertext|preflight|reconnect_required/);
 await receipt(db,3,'connected','ok','2026-10-09T14:00Z');const recovered=await read(db);assert.equal(recovered.connection.status,'active');assert.equal(recovered.evidenceState,'ready');
 await receipt(db,2,'failed','reconnect_required','2026-10-09T15:00Z');assert.equal((await read(db)).connection.status,'active');
 }finally{await db.close();}});
test('later transient failure marks retained evidence stale, review takes precedence and replacement ignores old failure',async()=>{const db=await fixture();try{
 await receipt(db,3,'failed','provider_unavailable','2026-10-09T13:00Z');assert.equal((await read(db)).evidenceState,'stale');
 await db.exec(`INSERT INTO xero_v1.mapping_audit VALUES('${connection}','review_required','2026-10-09T14:00Z')`);assert.equal((await read(db)).evidenceState,'review_required');
 await db.exec('DELETE FROM xero_v1.mapping_audit');await receipt(db,3,'failed','invalid_grant','2026-10-09T14:00Z');assert.equal((await read(db)).connection.status,'reauthorization_required');
 await db.exec('UPDATE xero_v1.credential_envelopes SET version=4');assert.equal((await read(db)).connection.status,'active');
 }finally{await db.close();}});
test('membership and existing execute grants stay isolated; reader changes no source rows',async()=>{const db=await fixture();try{
 await assert.rejects(read(db,'10000000-0000-4000-8000-000000000002'),/access denied/);
 await assert.rejects(read(db,owner,'20000000-0000-4000-8000-000000000002'),/access denied/);
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.xero_merchant_readiness($1)',[store]),/permission denied/);await db.exec('RESET ROLE');
 await read(db);assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.accounting_evidence')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int n FROM xero_v1.credential_envelopes')).rows[0].n,1);
 assert.doesNotMatch(migration,/GRANT |INSERT INTO|UPDATE |DELETE FROM/);
 }finally{await db.close();}});
