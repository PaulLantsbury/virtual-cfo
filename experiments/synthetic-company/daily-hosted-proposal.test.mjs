import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareHostedDailyProposal} from './daily-hosted-proposal.mjs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {dailyTestPostgres,mkdtempTest} from './daily-test-runtime.mjs';
const capabilitySql=await readFile(new URL('./daily-capability.sql',import.meta.url),'utf8');
test('hosted proposal pins reviewed code and adds real target guards without changing financial function bodies',()=>{
 const result=prepareHostedDailyProposal({capabilitySql,expectedThrough:'2026-11-04'});
 assert.equal(result.remoteApplied,false);assert.equal(result.activationAllowed,false);
 assert.match(result.sql,/Reviewed PostgreSQL 17 target required/);assert.match(result.sql,/Exact isolated staging contract\/horizon required/);
 assert.match(result.sql,/Reviewed closed-month seal count differs/);
 const boundary='CREATE FUNCTION finance_daily_v1.validate_reviewed_day';
 assert.equal(result.sql.slice(result.sql.indexOf(boundary)),capabilitySql.slice(capabilitySql.indexOf(boundary)));
 assert.equal(result.sqlSha256,prepareHostedDailyProposal({capabilitySql,expectedThrough:'2026-11-04'}).sqlSha256);
});
test('changed source, unbounded counts and malformed dates cannot produce an installation proposal',()=>{
 for(const patch of [{capabilitySql:capabilitySql+'\n'},{expectedThrough:'2026-02-30'},{expectedSeals:-1},{expectedSeals:121}])assert.throws(()=>prepareHostedDailyProposal({capabilitySql,expectedThrough:'2026-11-04',...patch}));
});
test('native PostgreSQL target guards refuse a changed baseline atomically before installing reviewed authority',async()=>{
 const {bin,share}=dailyTestPostgres(),dir=await mkdtempTest('hosted-proposal-');
 const {Client}=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('pg');
 let db,started=false;
 try{
  execFileSync(bin+'initdb',['-D',dir+'/data','-L',share,'-U','hosted_proposal_fixture','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
  execFileSync(bin+'pg_ctl',['-D',dir+'/data','-l',dir+'/server.log','-o',`-h '' -k ${dir}`,'-w','start'],{stdio:'pipe'});started=true;
  db=new Client({host:dir,user:'hosted_proposal_fixture',database:'postgres',password:async()=>'',ssl:false});await db.connect();
  await db.query('CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text)');
  await db.query("INSERT INTO public.stores VALUES('d7500000-0000-4000-8000-000000000009','GBP','Europe/London')");
  await db.query(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));
  await db.query("INSERT INTO finance_history_v2.contracts VALUES('d7500000-0000-4000-8000-000000000009','uk-gifts-v2','synthetic-history-v2-2026-11','2024-11-01','2026-11-04','GBP','Europe/London')");
  await assert.rejects(db.query(prepareHostedDailyProposal({capabilitySql,expectedThrough:'2026-11-03',expectedSeals:0}).sql),/contract\/horizon/);await db.query('ROLLBACK');
  await assert.rejects(db.query(prepareHostedDailyProposal({capabilitySql,expectedThrough:'2026-11-04'}).sql),/seal count/);await db.query('ROLLBACK');
  assert.equal((await db.query("SELECT to_regnamespace('finance_daily_v1') IS NULL absent")).rows[0].absent,true);
  await db.query(prepareHostedDailyProposal({capabilitySql,expectedThrough:'2026-11-04',expectedSeals:0}).sql);
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname IN('daily_capability_owner','daily_capability_invoker','daily_capability_reviewer')")).rows[0].n,3);
  assert.equal((await db.query('SELECT through_day::text FROM finance_history_v2.contracts')).rows[0].through_day,'2026-11-04');
 }finally{if(db)await db.end();if(started)execFileSync(bin+'pg_ctl',['-D',dir+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}
});
