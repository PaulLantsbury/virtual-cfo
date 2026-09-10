// Opt-in standalone PostgreSQL test. Creates and removes its own temporary cluster.
// Never reads DATABASE_URL or connects to an existing database/server.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {restorationFixture,identity} from './restoration-fixture.mjs';
import {A,B,U} from './finance-fixture.mjs';
import {initialiseReviewRuntime} from './review-runtime.mjs';
import {restoreReviewedPeriod} from './restore-reviewed-period.mjs';
const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));
const {Client,Pool,types}=require('pg');types.setTypeParser(1082,v=>v);
const bin=process.env.NIGHT_SCOUT_TEST_PG_BIN;
assert.ok(bin,'Set NIGHT_SCOUT_TEST_PG_BIN to a standalone PostgreSQL bin directory');
const root=await mkdtemp(join(tmpdir(),'ns-pg-')),data=join(root,'data');
const run=(name,args)=>execFileSync(join(resolve(bin),name),args,{encoding:'utf8',stdio:'pipe'});
const connect=async database=>{const c=new Client({host:root,port:5432,user:'night_scout_test',database});await c.connect();return c;};
const adapter=(c,onLock,asService=false)=>({query:(...args)=>c.query(...args),exec:async sql=>{const result=await c.query(sql);if(sql==='SELECT ingest_v1.lock_review_dependencies()')await onLock?.();return result;},transaction:async fn=>{await c.query('BEGIN');try{if(asService)await c.query('SET LOCAL ROLE night_scout_review_service');const result=await fn(adapter(c,onLock));await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const outcome=p=>p.then(value=>({value}),error=>({error}));
async function waiting(observer,client){
 const until=Date.now()+3000;
 while(Date.now()<until){
  const {rows}=await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[client.processID]);
  if(rows[0]?.wait_event_type==='Lock')return;
  await new Promise(r=>setTimeout(r,10));
 }
 throw new Error('Expected independently observed lock wait');
}
let started=false,admin;
try{
 run('initdb',['-D',data,'-U','night_scout_test','--auth=trust','--no-locale','--encoding=UTF8']);
 run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-h '' -k ${root}`,'-w','start']);started=true;
 admin=await connect('postgres');await admin.query('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role');
 console.log(run('postgres',['--version']).trim());
 for(const name of ['writer_commit','writer_rollback','review_first','review_first_raw','two_reviews','permission_revoked','lock_timeout']){
  await admin.query(`CREATE DATABASE ${name}`);
  const reviewer=await connect(name),writer=await connect(name),observer=await connect(name);
  try{
   const f=await restorationFixture(adapter(reviewer),{createRoles:false});
   if(['writer_commit','writer_rollback','permission_revoked','lock_timeout'].includes(name)){
    await writer.query('BEGIN');
    if(name==='permission_revoked')await writer.query('DELETE FROM ingest_v1.review_authorizations WHERE store_id=$1',[A]);
    else await writer.query('UPDATE public.orders SET gross_sales=gross_sales+1 WHERE store_id=$1',[A]);
    const pending=outcome(restoreReviewedPeriod(adapter(reviewer,undefined,true),f.request,identity));
    await waiting(observer,reviewer);
    if(name==='lock_timeout'){
     const result=await pending;assert.equal(result.error?.code,'55P03');await writer.query('ROLLBACK');
    }else{
     await writer.query(name==='writer_rollback'?'ROLLBACK':'COMMIT');
     const result=await pending;
     if(name==='writer_rollback')assert.equal(result.value?.status,'restored');
     else assert.match(result.error?.message??'',name==='permission_revoked'?/not authorised/:/snapshot changed/);
    }
   }else{
    const locked=deferred(),release=deferred();
    const first=outcome(restoreReviewedPeriod(adapter(reviewer,async()=>{locked.resolve();await release.promise;},true),f.request,identity));
    await Promise.race([locked.promise,first.then(r=>{throw r.error??new Error('Review ended before lock barrier');})]);
    // Ordinary reads from another session still work while reviewer holds locks.
    assert.equal((await observer.query('SELECT count(*)::int n FROM public.orders WHERE store_id=$1',[B])).rows[0].n,1);
    const second=name==='two_reviews'?outcome(restoreReviewedPeriod(adapter(writer,undefined,true),f.request,identity)):outcome(writer.query(name==='review_first_raw'?'UPDATE public.orders SET gross_sales=gross_sales+1 WHERE store_id=$1':"UPDATE finance_v1.refund_evidence SET evidence_ref='concurrent-change' WHERE store_id=$1",[A]));
    try{await waiting(observer,writer);}finally{release.resolve();}
    assert.equal((await first).value?.status,'restored');
    const secondResult=await second;
    if(name==='two_reviews')assert.match(secondResult.error?.message??'',/snapshot changed/);else assert.equal(secondResult.error,undefined);
   }
   const audits=(await observer.query('SELECT count(*)::int n FROM ingest_v1.review_audit')).rows[0].n;
   assert.equal(audits,['writer_rollback','review_first','review_first_raw','two_reviews'].includes(name)?1:0);
   const complete=(await observer.query('SELECT sales_and_refunds_complete FROM finance_v1.coverage_evidence WHERE store_id=$1 AND date_from=$2',[A,'2026-08-01'])).rows[0].sales_and_refunds_complete;
   assert.equal(complete,['writer_rollback','two_reviews'].includes(name));
   if(complete)assert.equal((await f.read()).netProductSales,12300);else await assert.rejects(f.read(),/coverage/);
   assert.equal((await f.read(B)).netProductSales,98700);
   console.log(`PASS ${name}: observed lock wait, final coverage and audit checked`);
  }finally{await Promise.all([reviewer.end(),writer.end(),observer.end()]);}
 }
 // Actual restricted LOGIN and pg Pool adapter; no live Auth/project is contacted.
 await admin.query('CREATE DATABASE runtime_check');
 const owner=await connect('runtime_check');let runtime;
 try{
  const fixture=await restorationFixture(adapter(owner),{createRoles:false});
  await admin.query('CREATE ROLE night_scout_review_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  await admin.query('GRANT night_scout_review_service TO night_scout_review_login');
  const ref='abcdefghijklmnopqrst';
  runtime=await initialiseReviewRuntime({projectRef:ref,authUrl:`https://${ref}.supabase.co`,publishableKey:'sb_publishable_synthetic',databaseUrl:`postgresql://night_scout_review_login:synthetic@db.${ref}.supabase.co/postgres`},{
   // Test-only transport override: isolated Unix socket, never a cloud database.
   createPool:options=>new Pool({...options,host:root,database:'runtime_check',ssl:false}),
   createAuthClient:()=>({auth:{getUser:async()=>({data:{user:{id:U,is_anonymous:false}},error:null})}}),
  });
  const packet=await runtime.service.prepare(fixture.request.scope,'Bearer synthetic-token');
  assert.equal(packet.snapshotDigest,fixture.request.snapshotDigest);
  assert.equal((await runtime.service.restore(fixture.request,'Bearer synthetic-token')).status,'restored');
  assert.equal((await fixture.read()).netProductSales,12300);
  console.log('PASS runtime_check: actual restricted LOGIN, pg Pool and review composition');
 }finally{await runtime?.close();await owner.end();}
}finally{
 await admin?.end();
 if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
 await rm(root,{recursive:true,force:true});
}
