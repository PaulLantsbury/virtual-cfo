import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
import {activationInstallerSql,disabledProgrammeRowsSql} from './prepare-activation-installer.mjs';
test('atomic installer creates disabled isolated capability with no password or programme, browser denied',async()=>{
 const db=new PGlite();try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);');
  const sql=activationInstallerSql();assert.doesNotMatch(sql,/PASSWORD\s+['"]/i);assert.equal(sql,readFileSync(new URL('./provider-activation-install.sql',import.meta.url),'utf8'));
  await db.exec(sql);
  assert.equal((await db.query('SELECT count(*) AS n FROM staging_test_programme.programmes')).rows[0].n,0);
  const roles=(await db.query("SELECT rolname,rolpassword,rolcanlogin FROM pg_authid WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service') ORDER BY rolname")).rows;
  assert.equal(roles[0].rolpassword,null);assert.equal(roles[0].rolcanlogin,true);assert.equal(roles[1].rolcanlogin,false);
  await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT * FROM staging_test_programme.writer_envelopes'));await assert.rejects(db.query("SELECT staging_test_programme.stop_programme('x')"));await db.exec('RESET ROLE');
  await assert.rejects(db.exec(sql),/target occupied/);await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT count(*) AS n FROM staging_test_programme.actions')).rows[0].n,0);
 }finally{await db.close();}
});
test('unverified provider targets cannot produce rows; verified exact two rows disabled',async()=>{
 assert.throws(()=>disabledProgrammeRowsSql({shopifyVerifiedDevelopment:true,xeroVerifiedDemo:false,xeroTenant:'90000000-0000-4000-8000-000000000002'}));
 const db=new PGlite();try{
  await db.exec('CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);');
  await db.exec(activationInstallerSql());
  await db.exec(disabledProgrammeRowsSql({shopifyVerifiedDevelopment:true,xeroVerifiedDemo:true,xeroTenant:'90000000-0000-4000-8000-000000000002'}));
  const r=(await db.query('SELECT provider,enabled,stopped,action_cap FROM staging_test_programme.programmes ORDER BY provider')).rows;
  assert.equal(r.length,2);assert.equal(r.every(r=>!r.enabled && !r.stopped && r.action_cap===6),true);
  await db.exec(disabledProgrammeRowsSql({shopifyVerifiedDevelopment:true,xeroVerifiedDemo:true,xeroTenant:'90000000-0000-4000-8000-000000000002'}));
  assert.equal((await db.query('SELECT count(*) AS n FROM staging_test_programme.programmes')).rows[0].n,2);
  await assert.rejects(db.exec(disabledProgrammeRowsSql({shopifyVerifiedDevelopment:true,xeroVerifiedDemo:true,xeroTenant:'90000000-0000-4000-8000-000000000003'})),/incompatible/);await db.exec('ROLLBACK');
  await db.exec(readFileSync(new URL('./activation-postflight.sql',import.meta.url),'utf8'));
 }finally{await db.close();}
});
