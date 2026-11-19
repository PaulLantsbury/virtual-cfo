import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewedMaterialRange,materialDigest,compileReviewedProgramme} from './daily-material.mjs';
import {historySourceAsOf} from './history-context.mjs';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validateDailyProgramme} from './daily-programme.mjs';
const options={initialThrough:'2026-11-18',ceiling:'2026-12-19',reviewRef:'offline reviewed finite programme',expectedPrefixFingerprint:'a'.repeat(64),generatedAt:'2026-11-19T00:00:00.000Z'};
test('finite compiler range is contiguous, bounded and deterministic across month end',()=>{
 const a=reviewedMaterialRange(options),b=reviewedMaterialRange({...options});assert.deepEqual(a,b);assert.equal(a.days.length,31);assert.equal(a.firstDay,'2026-11-19');assert.equal(a.days.at(-1),'2026-12-19');assert.ok(a.days.includes('2026-11-30'));assert.equal(materialDigest(a),materialDigest(b));
});
test('invalid ranges, missing review, missing independently reviewed prefix and future preparation time fail',()=>{
 for(const patch of [{initialThrough:'2026-02-30'},{ceiling:'2026-11-18'},{ceiling:'2028-01-01'},{reviewRef:''},{reviewRef:' padded '},{reviewRef:'bad\nref'},{reviewRef:'a'.repeat(201)},{expectedPrefixFingerprint:null},{expectedPrefixFingerprint:'not a digest'},{generatedAt:'2999-01-01T00:00:00.000Z'}])assert.throws(()=>reviewedMaterialRange({...options,...patch}));
});
test('modeled completed-day boundary follows London midnight across both DST changes',()=>{
 assert.equal(historySourceAsOf('2027-03-27'),'2027-03-28T00:00:00.000Z');assert.equal(historySourceAsOf('2027-03-28'),'2027-03-28T23:00:00.000Z');assert.equal(historySourceAsOf('2026-10-24'),'2026-10-24T23:00:00.000Z');assert.equal(historySourceAsOf('2026-10-25'),'2026-10-26T00:00:00.000Z');
});
test('programme digest is property-order independent and binds exact reviewed content',()=>{
 assert.equal(materialDigest({a:1,b:{z:3,y:2}}),materialDigest({b:{y:2,z:3},a:1}));assert.notEqual(materialDigest({day:'2026-11-19'}),materialDigest({day:'2026-11-20'}));
});
test('compiler rejects connection strings and unreviewed compiler options before database use',async()=>{
 let queries=0;const fake={query(){queries++;throw Error('must not execute');}};await assert.rejects(compileReviewedProgramme(fake,{...options,connectionString:'forbidden'}),/offline compiler options/);assert.equal(queries,0);
});

test('compiler refuses unbranded clients without querying',async()=>{
 let queries=0;const fake={query(){queries++;throw Error('must not execute');}};await assert.rejects(compileReviewedProgramme(fake,options),/Branded disposable/);assert.equal(queries,0);
});

for(const engine of ['in-memory','native-pg17'])test(`${engine} PostgreSQL compiles two contiguous days and one month seal; deterministic replay fixtures and prefix drift refusal`,{timeout:180000},async()=>{
 const {createHistoryRehearsal,importHistory,HISTORY_TABLES}=await import('./history-rehearsal.mjs');
 const {createInMemoryDailyClient,initialiseDisposableDailyFixture,brandDisposableDailyClient}=await import('./daily-writer.mjs');
 const {reviewedPrefixFingerprint}=await import('./daily-material.mjs');
 const {RESERVED_SYNTHETIC_IDENTITY:identity}=await import('./staging-payload.mjs');
 const h=await createHistoryRehearsal({withLoadedJanuary:false,now:()=>new Date('2024-11-29T00:00:00.000Z')});
 const clients=[],clusters=[];
 try{
  await importHistory(h,{asOf:'2024-11-29',from:'2024-11-01'});const fixture={};for(const table of HISTORY_TABLES)fixture[table]=(await h.db.query(`SELECT to_jsonb(t) AS row FROM finance_history_v2.${table} t`)).rows.map(r=>r.row);
  const fresh=async()=>{
   let c;
   if(engine==='in-memory')c=await createInMemoryDailyClient();
   else{
    const {dailyTestPostgres,mkdtempTest}=await import('./daily-test-runtime.mjs'),{bin,share}=dailyTestPostgres(),dir=await mkdtempTest('material-');
    execFileSync(bin+'initdb',['-D',dir+'/data','-L',share,'-U','material_test_owner','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
    execFileSync(bin+'pg_ctl',['-D',dir+'/data','-l',dir+'/postgres.log','-o',`-h '' -k ${dir}`,'-w','start'],{stdio:'pipe'});clusters.push({bin,dir});
    const {Client}=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url))('pg');
    c=new Client({host:dir,user:'material_test_owner',database:'postgres'});await c.connect();c.exec=sql=>c.query(sql);c.close=()=>c.end();brandDisposableDailyClient(c,{kind:'new-disposable-unix-cluster',host:dir});
    assert.ok(Number((await c.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version)>=170000);assert.ok(Number((await c.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version)<180000);
   }
   clients.push(c);
   await c.exec("CREATE TABLE public.stores(id uuid PRIMARY KEY,currency_code text,timezone text);CREATE TABLE public.disposable_fixture_receipts(store_id uuid PRIMARY KEY,fixture_hash text NOT NULL);CREATE SCHEMA finance_v1;CREATE TABLE finance_v1.original_january(body jsonb);INSERT INTO finance_v1.original_january VALUES('{\"protected\":\"original January\"}')");
   await c.query("INSERT INTO public.stores VALUES($1,'GBP','Europe/London')",[identity.storeId]);await c.exec(await readFile(new URL('./history-schema.sql',import.meta.url),'utf8'));
   await c.exec('CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY)');await c.exec(await readFile(new URL('./history-correction-schema.sql',import.meta.url),'utf8'));
   await initialiseDisposableDailyFixture(c,fixture);return c;
  };
  const a=await fresh(),b=await fresh(),expectedPrefixFingerprint=await reviewedPrefixFingerprint(a);assert.equal(await reviewedPrefixFingerprint(b),expectedPrefixFingerprint);
  const input={...options,initialThrough:'2024-11-28',ceiling:'2024-11-30',expectedPrefixFingerprint};
  const first=await compileReviewedProgramme(a,input),second=await compileReviewedProgramme(b,input);assert.deepEqual(first,second);assert.equal(first.manifest.entries.length,2);assert.equal(first.materials[0].material.seals.length,0);assert.equal(first.materials[1].material.seals.length,1);assert.equal(first.materials[1].material.expectedThrough,'2024-11-29');assert.equal(first.materials[1].material.coverage.length,2);
  assert.deepEqual(validateDailyProgramme(first.programme),first.programme);assert.equal(first.programme.days.length,2);assert.equal(first.programme.days[1].materialSha256,first.materials[1].material_sha256);assert.ok(Object.isFrozen(first.programme)&&Object.isFrozen(first.programme.days));
  assert.deepEqual((await a.query('SELECT body FROM finance_v1.original_january')).rows,[{body:{protected:'original January'}}]);
  assert.equal((await a.query('SELECT through_day::text AS day FROM finance_history_v2.contracts')).rows[0].day,'2024-11-30');
  for(const row of first.materials){const proof=(await a.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') AS hash",[JSON.stringify(row.material)])).rows[0].hash;assert.equal(row.material_sha256,proof);assert.equal(row.material.coverage[0].source_manifest.observedAt,historySourceAsOf(row.day));}
  await assert.rejects(compileReviewedProgramme(a,input),/prefix fingerprint differs/);
  const drift=await fresh();await drift.exec("UPDATE finance_v1.original_january SET body='{\"changed\":true}'");await assert.rejects(compileReviewedProgramme(drift,input),/prefix fingerprint differs/);assert.equal((await drift.query('SELECT through_day::text AS day FROM finance_history_v2.contracts')).rows[0].day,'2024-11-28');
  console.log(`Material evidence: ${engine}; this compiler test does not establish hosted grants, scheduler or activation acceptance.`);
 }finally{await h.db.close();await Promise.allSettled(clients.map(c=>c.close()));for(const {bin,dir}of clusters)execFileSync(bin+'pg_ctl',['-D',dir+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}
});
