import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHistoryRehearsal,importHistory} from './history-rehearsal.mjs';
import {createHistoryService} from './history-reader.mjs';
import {loadPinnedHistoryBaseline,assertBenchmarkDigest,resolveBenchmarkPostgres} from './history-performance.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';

const baseCommit='1022f42aff121df1b8cb5451d76bba3a341d7477';
const now=()=>new Date('2026-11-06T12:00:00Z');
const auth=id=>({auth:{getUser:async()=>({data:{user:{id,is_anonymous:false}}})}});

test('pinned reader and optimised maps produce identical sealed results and retain raw validation',async()=>{
 const h=await createHistoryRehearsal({withLoadedJanuary:false,now});
 const temporary=await mkdtemp(join(tmpdir(),'reader-review-baseline-'));
 try{
  await importHistory(h,{from:'2024-11-01',asOf:'2025-02-01'});
  const baseline=await loadPinnedHistoryBaseline(baseCommit,temporary),scope={storeId:h.storeId,currency:'GBP'};
  const readers=[baseline.createReader,createHistoryService].map(factory=>factory(h.db,auth(h.reviewerId),{now}));
  const before=digest((await h.db.query('SELECT to_jsonb(s) row FROM finance_history_v2.seals s ORDER BY snapshot_id')).rows);
  const available=await readers[0].available(scope,'Bearer local-review');
  assert.deepEqual(await readers[1].available(scope,'Bearer local-review'),available);
  assert.equal(available.months.length,3);
  for(const month of available.months){
   const selection={edition:available.edition,versionId:month.versionId},period={...scope,from:month.from,to:month.to};
   const expected=await readers[0].read(period,'Bearer local-review',selection);
   assert.equal(expected.state,'supported');
   assert.deepEqual(await readers[1].read(period,'Bearer local-review',selection),expected);
  }
  // Map keys are backed by actual (store_id, source_id) primary keys, not a duplicate-last assumption.
  await assert.rejects(h.db.exec('INSERT INTO finance_history_v2.lines SELECT * FROM finance_history_v2.lines LIMIT 1'),/duplicate key/);
  const source=(await h.db.query("SELECT source_id FROM finance_history_v2.orders WHERE event_date BETWEEN '2025-01-01' AND '2025-01-31' LIMIT 1")).rows[0];
  await h.db.exec('ALTER TABLE finance_history_v2.orders DISABLE TRIGGER history_immutable');
  await h.db.query("UPDATE finance_history_v2.orders SET body=jsonb_set(body,'{net_sales}','\"999.99\"') WHERE source_id=$1",[source.source_id]);
  await h.db.exec('ALTER TABLE finance_history_v2.orders ENABLE TRIGGER history_immutable');
  const jan=available.months.find(m=>m.from==='2025-01-01');
  for(const reader of readers)await assert.rejects(reader.read({...scope,from:jan.from,to:jan.to},'Bearer local-review',{edition:available.edition,versionId:jan.versionId}),/scope\/hash changed/);
  assert.equal(digest((await h.db.query('SELECT to_jsonb(s) row FROM finance_history_v2.seals s ORDER BY snapshot_id')).rows),before);
 }finally{await h.db.close();await rm(temporary,{recursive:true,force:true});}
});

test('availability context is reused once per transaction but never across source or membership changes',async()=>{
 const h=await createHistoryRehearsal({withLoadedJanuary:false,now});
 try{
  await importHistory(h,{from:'2024-11-01',asOf:'2025-02-01'});
  const sql=[],db={transaction:fn=>h.db.transaction(tx=>fn({query:(query,args)=>{sql.push(query);return tx.query(query,args);},exec:query=>tx.exec(query)}))};
  const service=createHistoryService(db,auth(h.reviewerId),{now}),scope={storeId:h.storeId,currency:'GBP'};
  const available=await service.available(scope,'Bearer local-review');
  assert.equal(sql.filter(query=>query.includes('FROM finance_history_v2.contracts WHERE')).length,1);
  assert.equal(sql.filter(query=>query.startsWith('SELECT currency_code,timezone FROM public.stores')).length,1);
  await h.db.query("UPDATE public.stores SET currency_code='EUR' WHERE id=$1",[h.storeId]);
  assert.deepEqual((await service.available(scope,'Bearer local-review')).months,[]);
  await h.db.query("UPDATE public.stores SET currency_code='GBP' WHERE id=$1",[h.storeId]);
  assert.deepEqual(await service.available(scope,'Bearer local-review'),available);
  await h.db.query('DELETE FROM public.store_memberships WHERE store_id=$1 AND user_id=$2',[h.storeId,h.reviewerId]);
  await assert.rejects(service.available(scope,'Bearer local-review'),/membership required/);
  const jan=available.months.find(m=>m.from==='2025-01-01');
  await assert.rejects(service.read({...scope,from:jan.from,to:jan.to},'Bearer local-review',{edition:available.edition,versionId:jan.versionId}),/membership required/);
 }finally{await h.db.close();}
});

test('benchmark checks every full response and refuses source-revision drift even when money matches',()=>{
 const expected={},original={amount:4500000,salesRevision:'original-source',metadata:{snapshot:'explicit-version'}};
 assertBenchmarkDigest(expected,'january',original);
 assertBenchmarkDigest(expected,'january',structuredClone(original));
 assert.throws(()=>assertBenchmarkDigest(expected,'january',{...original,salesRevision:'changed-source'}),/Benchmark response changed/);
 assert.throws(()=>assertBenchmarkDigest(expected,'january',{...original,metadata:{snapshot:'other-version'}}),/Benchmark response changed/);
});


test('benchmark resolves matched PostgreSQL binaries/share files without workspace paths',()=>{
 const calls=[],run=(file,args)=>{calls.push([file,...args]);return args[0]==='--bindir'?'/portable/pg/bin\n':'/portable/pg/share\n';};
 assert.deepEqual(resolveBenchmarkPostgres({pgConfig:'/portable/pg/bin/pg_config',run}),{initdb:'/portable/pg/bin/initdb',pgCtl:'/portable/pg/bin/pg_ctl',sharedir:'/portable/pg/share'});
 assert.deepEqual(calls,[['/portable/pg/bin/pg_config','--bindir'],['/portable/pg/bin/pg_config','--sharedir']]);
 calls.length=0;
 assert.equal(resolveBenchmarkPostgres({sharedir:'/approved/share',run}).sharedir,'/approved/share');
 assert.deepEqual(calls,[['pg_config','--bindir']]);
 assert.throws(()=>resolveBenchmarkPostgres({sharedir:'relative/share',run}),/Absolute PostgreSQL/);
 assert.throws(()=>resolveBenchmarkPostgres({run:()=>'/bad\n/path'}),/Absolute PostgreSQL/);
});
