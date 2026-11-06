/** Offline PostgreSQL benchmark. Fresh private Unix-socket cluster; never reads connection URLs. */
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadavg} from 'node:os';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import pg from '../../artifacts/api-server/node_modules/pg/lib/index.js';
import {createHistoryService} from './history-reader.mjs';
import {prepareHistoryReadAccess} from './history-read-access.mjs';
import {createHistoryRehearsal,importHistory} from './history-rehearsal.mjs';
const now=()=>new Date('2026-11-06T12:00:00Z');
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Read-only local Git baseline. No checkout, network, mutable branch or operational configuration. */
export async function loadPinnedHistoryBaseline(baseCommit,privateDirectory){
 ensure(/^[a-f0-9]{40}$/.test(baseCommit),'Exact baseline commit required');
 const source=execFileSync('git',['show',`${baseCommit}:experiments/synthetic-company/history-reader.mjs`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
 const rewritten=source.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_match,_quote,path)=>`from ${JSON.stringify(new URL(path,new URL('./history-reader.mjs',import.meta.url)).href)}`);
 const path=join(privateDirectory,`history-baseline-${baseCommit}.mjs`);
 await writeFile(path,rewritten,{mode:0o600});
 return {createReader:(await import(pathToFileURL(path).href)).createHistoryService,sourceSha256:sha256(source),baseCommit};
}
/** Refuse silent per-sample drift, even when headline totals happen to match. */
export function assertBenchmarkDigest(expected,key,value){
 const actual=digest(value);if(expected[key]!==undefined)assert.equal(actual,expected[key],`Benchmark response changed: ${key}`);else expected[key]=actual;
 return actual;
}
/** Resolve server binaries and share files from one explicit/local pg_config installation. */
export function resolveBenchmarkPostgres({pgConfig='pg_config',sharedir,run=(file,args)=>execFileSync(file,args,{encoding:'utf8'})}={}){
 const bindir=String(run(pgConfig,['--bindir'])).trim();
 const share=sharedir??String(run(pgConfig,['--sharedir'])).trim();
 ensure(typeof share==='string'&&[bindir,share].every(path=>isAbsolute(path)&&!/[\r\n\0]/.test(path)),'Absolute PostgreSQL binary/share directories required');
 return {initdb:join(bindir,'initdb'),pgCtl:join(bindir,'pg_ctl'),sharedir:share};
}
export async function benchmarkHistory({fixturePath,outputPath,reader=createHistoryService,indexProposal=false,variants,rounds=4,warmups=0,postgres={}}={}){
 ensure(Number.isInteger(rounds)&&rounds>=1&&Number.isInteger(warmups)&&warmups>=0,'Explicit non-negative benchmark rounds required');
 const sourceBefore=await readFile(new URL('./history-reader.mjs',import.meta.url));
 const harnessSourceBefore=await readFile(new URL(import.meta.url));
 const readers=variants??[{name:'candidate',createReader:reader,sourceSha256:sha256(sourceBefore)}];
 ensure(readers.length>0&&new Set(readers.map(r=>r.name)).size===readers.length&&readers.every(r=>typeof r.createReader==='function'&&/^[a-f0-9]{64}$/.test(r.sourceSha256)),'Unique named readers with source hashes required');
 ensure(fixturePath&&outputPath,'Explicit private fixture/output paths required');
 let fixture,fixtureBytes;try{fixtureBytes=await readFile(fixturePath);fixture=JSON.parse(fixtureBytes.toString('utf8'));}catch(e){if(e.code!=='ENOENT')throw e;
  const h=await createHistoryRehearsal({withLoadedJanuary:false,now});try{await importHistory(h,{asOf:'2026-11-05',from:'2024-11-01'});const rows={};for(const {tablename}of (await h.db.query("SELECT tablename FROM pg_tables WHERE schemaname='finance_history_v2' ORDER BY tablename")).rows)rows[tablename]=(await h.db.query(`SELECT to_jsonb(t) row FROM finance_history_v2.${tablename} t`)).rows.map(r=>r.row);fixture={storeId:h.storeId,reviewerId:h.reviewerId,rows};fixtureBytes=Buffer.from(JSON.stringify(fixture));await writeFile(fixturePath,fixtureBytes,{mode:0o600});}finally{await h.db.close();}}
 const fixtureSha256=sha256(fixtureBytes);
 const dependencySources=[];
 for(const name of ['./history-versions.mjs','./history-context.mjs','./history-expense-correction.mjs','./staging-payload.mjs','../financial-v1/cloud-sales-adapter.mjs','../financial-v1/calculations.mjs','../financial-v1/profit-evidence-reader.mjs','../financial-v1/profit-reporting-service.mjs','../financial-v1/source-adapter.mjs','../shopify/reviewer-auth.mjs'])dependencySources.push({path:name,sha256:sha256(await readFile(new URL(name,import.meta.url)))});
 const pgTools=resolveBenchmarkPostgres(postgres);
 const loadBefore=loadavg();
 const root=await mkdtemp(join(tmpdir(),'history-performance-'));const data=join(root,'data');let started=false,client;
 const command=(name,args)=>execFileSync(name,args,{stdio:'pipe'});
 try{
  command(pgTools.initdb,['-D',data,'-L',pgTools.sharedir,'-U','history_test_owner','--auth=trust','--no-locale','--encoding=UTF8']);
  command(pgTools.pgCtl,['-D',data,'-l',join(root,'postgres.log'),'-o',`-h '' -k ${root}`,'-w','start']);started=true;
  client=new pg.Client({host:root,user:'history_test_owner',database:'postgres'});await client.connect();
  await client.query("CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE ROLE history_test_reader NOLOGIN NOINHERIT;CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text);CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);GRANT SELECT ON public.stores,public.store_memberships TO history_test_reader;ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;CREATE POLICY fixture_member ON public.store_memberships FOR SELECT TO history_test_reader USING(user_id=NULLIF(current_setting('night_scout.profit_user_id',true),'')::uuid);CREATE POLICY fixture_store ON public.stores FOR SELECT TO history_test_reader USING(EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.store_id=stores.id));");
  await client.query("INSERT INTO public.stores VALUES($1,'GBP','Europe/London')",[fixture.storeId]);await client.query('INSERT INTO public.store_memberships VALUES($1,$2)',[fixture.reviewerId,fixture.storeId]);
  for(const name of ['history-schema.sql','history-correction-schema.sql'])await client.query(await readFile(new URL(name,import.meta.url),'utf8'));
  // Foreign-key order is explicit; only rows generated in a new disposable fixture are copied.
  for(const table of ['contracts','events','orders','refunds','lines','returns','coverage','seals','invalidations','runs','correction_proposals','correction_reviews','correction_overlays','correction_versions','correction_selections','version_heads','correction_receipts']){
   const rows=fixture.rows[table]||[];for(let i=0;i<rows.length;i+=250)await client.query(`INSERT INTO finance_history_v2.${table} SELECT * FROM jsonb_populate_recordset(NULL::finance_history_v2.${table},$1::jsonb)`,[JSON.stringify(rows.slice(i,i+250))]);
  }
  await client.query(prepareHistoryReadAccess({serviceRole:'history_test_reader'}).commitSql);if(indexProposal)await client.query(await readFile(new URL('./history-performance-indexes.sql',import.meta.url),'utf8'));await client.query('ANALYZE');
  let queries=0;const sourceQueries=new Map();const tx={query:async(sql,args)=>{queries++;if(sql.startsWith('SELECT source_id'))sourceQueries.set(sql,args);return client.query(sql,args);},exec:async sql=>client.query(sql)};
  const db={transaction:async fn=>{await client.query('BEGIN');try{await client.query('SET LOCAL ROLE history_test_reader');const r=await fn(tx);await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}}};
  const auth=id=>({auth:{getUser:async()=>({data:{user:{id,is_anonymous:false}}})}});
  const services=readers.map(r=>({...r,service:r.createReader(db,auth(fixture.reviewerId),{now})}));
  const scope={storeId:fixture.storeId,currency:'GBP'},samples=[],resultDigests={},expectedDigests={};let availability;
  // Alternate AB/BA within one freshly loaded cluster; warmups are explicitly excluded from samples.
  for(let run=-warmups;run<rounds;run++){
   const ordered=(run+warmups)%2?[...services].reverse():services;
   for(const variant of ordered){const service=variant.service;
    queries=0;let start=performance.now();availability=await service.available(scope,'Bearer disposable');
    const availabilityMs=performance.now()-start;
    assertBenchmarkDigest(expectedDigests,'availability',availability);assert.equal(availability.months.length,24);
    if(run>=0)samples.push({variant:variant.name,kind:'availability',run,ms:availabilityMs,queries});
    for(const from of ['2025-01-01','2026-10-01']){
     const month=availability.months.find(m=>m.from===from);queries=0;start=performance.now();
     const r=await service.read({...scope,from,to:month.to},'Bearer disposable',{edition:'synthetic-history-v2-2026-11',versionId:month.versionId});
     const ms=performance.now()-start;
     resultDigests[from]=assertBenchmarkDigest(expectedDigests,from,r);assert.equal(r.state,'supported');
     if(run>=0)samples.push({variant:variant.name,kind:from,run,ms,queries});
     assert.equal(r.profit.revenueDenominator,from==='2025-01-01'?4500000:6750000);assert.equal(r.profit.ebitda,from==='2025-01-01'?217602:1059205);
    }
   }
  }
  const service=services.at(-1).service;
  const denialProof=true;
  for(const variant of readers){const denied=variant.createReader(db,auth('10000000-0000-4000-8000-000000000099'),{now});await assert.rejects(denied.available(scope,'Bearer disposable'),/membership required/);const jan=availability.months.find(m=>m.from==='2025-01-01');await assert.rejects(denied.read({...scope,from:jan.from,to:jan.to},'Bearer disposable',{edition:'synthetic-history-v2-2026-11',versionId:jan.versionId}),/membership required/);}
  await db.transaction(async t=>{await t.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[fixture.reviewerId]);await assert.rejects(t.query('DELETE FROM finance_history_v2.orders'),/permission denied/);}).catch(e=>{if(!/aborted/.test(e.message))throw e;});
  const counts=(await client.query("SELECT (SELECT count(*)::int FROM finance_history_v2.events) events,(SELECT count(*)::int FROM finance_history_v2.seals) seals,(SELECT count(DISTINCT event_date)::int FROM finance_history_v2.events WHERE NOT dependency_only) days")).rows[0];assert.equal(counts.seals,24);assert.equal(counts.days,734);
  const plans=[];await db.transaction(async t=>{await t.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[fixture.reviewerId]);for(const [sql,args]of sourceQueries)plans.push({sql,plan:(await t.query('EXPLAIN (FORMAT JSON) '+sql,args)).rows[0]['QUERY PLAN']});});
  const readSeals=async()=>digest((await client.query('SELECT to_jsonb(s) row FROM finance_history_v2.seals s ORDER BY snapshot_id')).rows.map(r=>r.row));
  const sealDigest=await readSeals();assert.equal(sealDigest,digest([...fixture.rows.seals].sort((a,b)=>a.snapshot_id.localeCompare(b.snapshot_id))));
  // Coherent privileged source corruption belongs only to this disposable cluster.
  const changed=(await client.query("SELECT source_id,body FROM finance_history_v2.events WHERE kind='expense_accrual' AND event_date BETWEEN '2025-01-01' AND '2025-01-31' ORDER BY source_id LIMIT 1")).rows[0];
  const body=structuredClone(changed.body),expense=body.postings.find(p=>p.account.startsWith('expense:')),counter=body.postings.find(p=>p!==expense);expense.amount+=100;counter.amount-=100;
  await client.query('BEGIN');try{await client.query('ALTER TABLE finance_history_v2.events DISABLE TRIGGER history_immutable');await client.query('UPDATE finance_history_v2.events SET body=$1::jsonb,row_hash=$2 WHERE source_id=$3',[JSON.stringify(body),digest(body),changed.source_id]);await client.query('ALTER TABLE finance_history_v2.events ENABLE TRIGGER history_immutable');await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}
  const jan=availability.months.find(m=>m.from==='2025-01-01');assert.equal((await service.read({...scope,from:jan.from,to:jan.to},'Bearer disposable',{edition:'synthetic-history-v2-2026-11',versionId:jan.versionId})).state,'unavailable');assert.equal(await readSeals(),sealDigest);
  const coherentCorruptionRefused=true;
  assert.equal(sha256(await readFile(new URL('./history-reader.mjs',import.meta.url))),sha256(sourceBefore),'Candidate source changed during benchmark');
  assert.equal(sha256(await readFile(fixturePath)),fixtureSha256,'Fixture bytes changed during benchmark');
  for(const dependency of dependencySources)assert.equal(sha256(await readFile(new URL(dependency.path,import.meta.url))),dependency.sha256,'Reader dependency changed during benchmark');
  assert.equal(sha256(await readFile(new URL(import.meta.url))),sha256(harnessSourceBefore),'Benchmark harness changed during measurement');
  const result={harnessSha256:sha256(harnessSourceBefore),dependencySources,comparisonScope:'reader-module-only-current-shared-dependencies',protocol:'same-cluster-alternating-v1',warmups,rounds,fixtureSha256,readerSources:readers.map(({name,sourceSha256,baseCommit})=>({name,sourceSha256,baseCommit:baseCommit??null})),loadBefore,loadAfter:loadavg(),availabilityDigest:digest(availability),sealDigest,database:(await client.query('SELECT version() version')).rows[0].version,role:'history_test_reader',indexProposal,plans,denialProof,coherentCorruptionRefused,counts,resultDigests,samples};await writeFile(outputPath,JSON.stringify(result,null,2),{mode:0o600});return result;
 }finally{if(client)await client.end();if(started)command(pgTools.pgCtl,['-D',data,'-m','fast','-w','stop']);await rm(root,{recursive:true,force:true});}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const [fixturePath,outputPath,flag,baseCommit]=process.argv.slice(2);
 if(flag==='--pair'){
  const privateDirectory=await mkdtemp(join(tmpdir(),'history-baseline-'));
  try{const baseline=await loadPinnedHistoryBaseline(baseCommit,privateDirectory);const candidateSource=await readFile(new URL('./history-reader.mjs',import.meta.url));
   const variants=[{name:'baseline',...baseline},{name:'candidate',createReader:createHistoryService,sourceSha256:sha256(candidateSource)}];
   console.log(JSON.stringify(await benchmarkHistory({fixturePath,outputPath,variants,rounds:6,warmups:1}),null,2));
  }finally{await rm(privateDirectory,{recursive:true,force:true});}
 }else console.log(JSON.stringify(await benchmarkHistory({fixturePath,outputPath,indexProposal:flag==='--index-proposal'}),null,2));
}
