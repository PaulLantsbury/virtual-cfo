/** Opt-in disposable PostgreSQL17+ multi-session rehearsal. Fresh private Unix
 * socket cluster only; never reads DATABASE_URL, hosted config or credentials.
 * Real schemas/reader; artificial Auth and SQL-only canonical fixture port. */
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {reviewedBrowserMonth} from '../../artifacts/virtual-cfo/tests/reviewed-pages.test-fixture.ts';
import {supplementalDigest as digest} from './supplemental-reader.mjs';
import {createCustomerSidecarService} from './customer-sidecar-reader.mjs';
const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));
const {Client,types}=require('pg');types.setTypeParser(1082,v=>v);
const bin=process.env.NIGHT_SCOUT_TEST_PG_BIN;
assert.ok(bin,'Set NIGHT_SCOUT_TEST_PG_BIN to standalone PostgreSQL binaries');
const root=await mkdtemp(join(tmpdir(),'ns-customer-pg-')),data=join(root,'data');
const run=(name,args)=>execFileSync(join(resolve(bin),name),args,{encoding:'utf8',stdio:'pipe'});
const connect=async database=>{const c=new Client({host:root,port:5432,user:'customer_test_owner',database});await c.connect();return c;};
const reviewer='61000000-0000-4000-8000-000000000001';
const uid=(prefix,index)=>`${prefix}000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
const outcome=p=>p.then(value=>({value}),error=>({error}));
const fingerprint=async(c,table)=>digest((await c.query(`SELECT to_jsonb(t)::text AS value FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows);
const readSql=async name=>readFile(new URL('./'+name,import.meta.url),'utf8');
async function setup(c){
 await c.query('CREATE TABLE public.stores(id uuid PRIMARY KEY);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid,PRIMARY KEY(user_id,store_id));CREATE TABLE public.unrelated_fixture(id int PRIMARY KEY,value text);INSERT INTO public.unrelated_fixture VALUES(1,\'preserve\');CREATE SCHEMA finance_history_v2;CREATE TABLE finance_history_v2.seals(snapshot_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);CREATE TABLE finance_history_v2.invalidations(snapshot_id uuid PRIMARY KEY);CREATE TABLE finance_history_v2.version_heads(store_id uuid,date_from date,date_to date,version_id uuid,selection_id uuid);CREATE TABLE finance_history_v2.correction_versions(version_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,sales_revision text,cost_revision text);CREATE TABLE finance_history_v2.correction_selections(selection_id uuid PRIMARY KEY,store_id uuid,date_from date,date_to date,previous_version_id uuid,version_id uuid);');
 const samples=Array.from({length:24},(_,i)=>{const f=structuredClone(reviewedBrowserMonth(new Date(Date.UTC(2024,10+i,1)).toISOString().slice(0,10),i)),version=uid('82',i+1);f.response.versionId=f.response.snapshotId=f.response.metadata.versionId=version;f.acquisition.financial.snapshotId=version;const activity=f.acquisition.customerActivity;delete f.acquisition.customerActivity;return {f,version,activity};});
 const store=samples[0].f.response.scope.storeId;
 await c.query('INSERT INTO public.stores VALUES($1)',[store]);await c.query('INSERT INTO public.store_memberships VALUES($1,$2)',[reviewer,store]);
 await c.query(await readSql('supplemental-schema.sql'));await c.query(await readSql('customer-sidecar-storage.sql'));await c.query(await readSql('customer-sidecar-recovery.sql'));
 let target;
 for(let i=0;i<24;i++){
  const {f,version,activity}=samples[i],s=f.response.scope;
  await c.query('INSERT INTO finance_history_v2.seals VALUES($1,$2,$3,$4,$5,$6)',[version,store,s.from,s.to,f.response.salesRevision,f.response.costRevision]);
  for(const [j,kind] of ['cash','acquisition'].entries()){
   const body={contract:'reviewed-supplement-v1',kind,scope:{...s,timezone:'Europe/London'},financialVersionId:version,salesRevision:f.response.salesRevision,costRevision:f.response.costRevision,sourceBasis:'synthetic-local',observedAt:'2026-11-20T12:00:00Z',payload:kind==='acquisition'?f.acquisition:{fixtureOnly:true}},id=uid('72',i*2+j+1),hash=digest(body);
   await c.query('INSERT INTO finance_review_supplement_v1.snapshots(snapshot_id,store_id,date_from,date_to,kind,financial_version,sales_revision,cost_revision,body,body_hash,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)',[id,store,s.from,s.to,kind,version,body.salesRevision,body.costRevision,JSON.stringify(body),hash,body.observedAt]);
   if(i===23&&kind==='acquisition')target={body,id,hash,activity,f,version,scope:s};
  }
 }
 const b=target.body,side={contract:'synthetic-customer-summary-sidecar-v1',baseBodyHash:target.hash,scope:b.scope,financialVersionId:b.financialVersionId,salesRevision:b.salesRevision,costRevision:b.costRevision,activity:target.activity};target.side=side;target.sideId=digest(side);
 await c.query('INSERT INTO finance_customer_sidecar_v1.versions VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)',[target.sideId,target.id,target.hash,store,target.version,b.scope.from,b.scope.to,b.salesRevision,b.costRevision,JSON.stringify(side)]);
 await c.query('GRANT USAGE ON SCHEMA finance_customer_sidecar_v1,finance_review_supplement_v1,finance_history_v2 TO customer_concurrency_reader;GRANT SELECT ON ALL TABLES IN SCHEMA finance_customer_sidecar_v1,finance_review_supplement_v1,finance_history_v2 TO customer_concurrency_reader;GRANT SELECT ON public.store_memberships TO customer_concurrency_reader;');
 return target;
}
const selection=async(c,f)=>c.query('INSERT INTO finance_customer_sidecar_v1.selections VALUES($1,$2,$3,$4)',[f.id,f.sideId,reviewer,'2026-11-21T10:00:00Z']);
function reader(c,f,{snapshot,release}={}){
 let paused=false;
 const tx={exec:sql=>c.query(sql),query:async(sql,args)=>{const r=await c.query(sql,args);if(!paused&&snapshot&&sql.startsWith('SELECT store_id FROM public.store_memberships')){paused=true;snapshot.resolve();await release.promise;}return r;}};
 const db={transaction:async fn=>{await c.query('BEGIN');try{await c.query('SET LOCAL ROLE customer_concurrency_reader');const value=await fn(tx);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}}};
 const service=createCustomerSidecarService(db,{auth:{getUser:async()=>({data:{user:{id:reviewer,is_anonymous:false}}})}},{now:()=>new Date('2026-11-21T12:00:00Z'),readHistory:async(t,s,opts)=>{
  const r=(await t.query("SELECT current_user AS name,current_setting('transaction_read_only') AS readonly,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0];assert.deepEqual(r,{name:'customer_concurrency_reader',readonly:'on',rolsuper:false,rolbypassrls:false});
  const valid=(await t.query('SELECT snapshot_id FROM finance_history_v2.seals s WHERE snapshot_id=$1 AND NOT EXISTS(SELECT 1 FROM finance_history_v2.invalidations i WHERE i.snapshot_id=s.snapshot_id)',[opts.selection.versionId])).rows;
  return valid.length===1?structuredClone(f.f.response):{state:'unavailable'};
 }});
 return ()=>service.read(f.scope,'Bearer disposable',{financialSelection:{edition:f.f.response.metadata.edition,versionId:f.version},baseSnapshotId:f.id,sidecarVersionId:f.sideId});
}
async function waiting(observer,client){const until=Date.now()+5000;while(Date.now()<until){if((await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[client.processID])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}throw Error('No independently observed lock wait');}
let started=false,admin;
try{
 run('initdb',['-D',data,'-U','customer_test_owner','--auth=trust','--no-locale','--encoding=UTF8']);
 run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-h '' -k ${root}`,'-w','start']);started=true;
 admin=await connect('postgres');await admin.query('CREATE ROLE customer_concurrency_reader NOLOGIN NOINHERIT;CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN');
 console.log(run('postgres',['--version']).trim());
 for(const name of ['withdrawal','membership','authority','duplicate']){
  await admin.query(`CREATE DATABASE customer_${name}`);const a=await connect('customer_'+name),b=await connect('customer_'+name),o=await connect('customer_'+name);
  try{
   const f=await setup(a),original=await fingerprint(o,'finance_review_supplement_v1.snapshots'),finance=await fingerprint(o,'finance_history_v2.seals'),other=await fingerprint(o,'public.unrelated_fixture');
   if(name==='duplicate'){
    await a.query('BEGIN');await selection(a,f);await b.query('BEGIN');const pending=outcome(selection(b,f));await waiting(o,b);await a.query('COMMIT');const result=await pending;assert.equal(result.error?.code,'23505');await b.query('ROLLBACK');assert.equal((await o.query('SELECT count(*)::int AS n FROM finance_customer_sidecar_v1.selections')).rows[0].n,1);assert.equal((await reader(a,f)()).state,'supported');
   }else{
    await selection(a,f);const snapshot=deferred(),release=deferred(),read=reader(a,f,{snapshot,release}),pending=outcome(read());await Promise.race([snapshot.promise,pending.then(r=>{throw r.error??Error('Reader ended before snapshot barrier');})]);
    try{
     if(name==='withdrawal')await b.query('INSERT INTO finance_customer_sidecar_v1.withdrawals VALUES($1,$2,$3,$4,$5)',[f.id,f.sideId,reviewer,'2026-11-21T11:00:00Z','owner-withdrawal']);
     if(name==='membership')await b.query('DELETE FROM public.store_memberships WHERE user_id=$1',[reviewer]);
     if(name==='authority')await b.query('INSERT INTO finance_history_v2.invalidations VALUES($1)',[f.version]);
    }finally{release.resolve();}
    const result=await pending;if(result.error)throw result.error;assert.equal(result.value.state,'supported','Already-open snapshot remains coherent old state');
    if(name==='membership')await assert.rejects(reader(a,f)(),/membership/);else assert.equal((await reader(a,f)()).state,'unavailable','Next transaction sees committed denial');
   }
   assert.equal(await fingerprint(o,'finance_review_supplement_v1.snapshots'),original);assert.equal(await fingerprint(o,'finance_history_v2.seals'),finance);assert.equal(await fingerprint(o,'public.unrelated_fixture'),other);
   console.log(`PASS ${name}: separate-session barriers, protected48 and financial/unrelated fixture preservation`);
  }finally{await Promise.allSettled([a.end(),b.end(),o.end()]);}
 }
 console.log('4/4 disposable multi-session cases passed; no hosted action, real Auth or full canonical recomputation claimed.');
}finally{if(admin)await admin.end();if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);await rm(root,{recursive:true,force:true});}
