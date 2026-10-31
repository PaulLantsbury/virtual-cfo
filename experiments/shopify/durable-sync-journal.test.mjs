import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,U,A} from './finance-fixture.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
import {createDurableSyncJournal,createJournaledOperatorSyncService} from './durable-sync-journal.mjs';
const scope={storeId:target.storeId,from:'2026-09-17',to:'2026-09-17'};
const receipt=()=>({...scope,status:'replay',batchId:'11111111-1111-4111-8111-111111111111',coverageCertified:false,reviewRequired:true,financeImported:false});
const inspected=()=>({...scope,projectRef:target.projectRef,status:'unavailable',observedAt:'2026-09-17T12:00:00Z',retainedBatchCount:0,coverageCertified:false,candidateWriteAttempted:false,reviewRequired:true,financialImportStatus:'not_assessed'});
async function fixture(){const {db}=await setup();await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));const restricted={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');return fn(tx);})};const journal=createDurableSyncJournal(restricted,{scope});return {db,restricted,journal,close:()=>db.close()};}
async function rpc(db,storeId,uid=U){return db.transaction(async tx=>{await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid??'']);await tx.exec('SET LOCAL ROLE authenticated');return (await tx.query('SELECT public.shopify_connection_status($1) result',[storeId])).rows[0].result;});}
test('durable start precedes intake; completed history survives controller recreation without certifying finances',async()=>{
 const f=await fixture();try{let calls=0;const options={scope,journal:f.journal,inspectCandidate:async()=>inspected(),runIntake:async()=>{calls++;assert.equal((await f.journal.latest()).state,'running');return receipt();}};
 const first=await createJournaledOperatorSyncService(options).run();assert.equal(first.lastAttempt.state,'completed');assert.equal(first.durableHistory.latestAttempt.state,'completed');assert.equal(first.durableHistory.latestAttempt.resultCode,'replay');assert.equal(calls,1);
 const restarted=await createJournaledOperatorSyncService(options).status();assert.equal(restarted.lastAttempt,null);assert.equal(restarted.durableHistory.latestAttempt.state,'completed');assert.equal(restarted.financialVerification,'not_assessed');assert.equal(restarted.historyPersistence,'durable');
 }finally{await f.close();}
});
test('unfinished and unconfirmed attempts block restart and database secondstart; completed attempts immutable',async()=>{
 const f=await fixture();try{
 const id=await f.journal.begin();await assert.rejects(f.journal.begin(),/unavailable/);
 const service=createJournaledOperatorSyncService({scope,journal:f.journal,inspectCandidate:async()=>inspected(),runIntake:()=>assert.fail('must not intake')});assert.equal((await service.run()).retryBlocked,true);
 await f.journal.finish(id,{state:'unconfirmed'});assert.equal((await service.status()).durableHistory.latestAttempt.state,'unconfirmed');await assert.rejects(f.journal.finish(id,{state:'completed',resultCode:'replay'}),/unavailable/);await assert.rejects(f.journal.begin(),/unavailable/);
 }finally{await f.close();}
 const g=await fixture();try{const id=await g.journal.begin();await g.journal.finish(id,{state:'completed',resultCode:'replay'});await assert.rejects(g.restricted.transaction(tx=>tx.query("UPDATE ingest_v1.sync_attempts SET state='completed',result_code='recorded_requires_review' WHERE id=$1",[id])),/transition/);}finally{await g.close();}
});
test('membership checked before private reads; browser receives only safe metadata and cannot access journal directly',async()=>{
 const f=await fixture();try{
 await assert.rejects(rpc(f.db,scope.storeId),/membership/);await f.db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,scope.storeId]);await assert.rejects(rpc(f.db,scope.storeId,null),/membership/);
 const first=await f.journal.begin();await f.journal.finish(first,{state:'completed',resultCode:'replay'});const second=await f.journal.begin();await f.journal.finish(second,{state:'completed',resultCode:'missing_source'});
 const result=await rpc(f.db,scope.storeId);assert.equal(result.latestAttempt.resultCode,'missing_source');assert.equal(result.latestSuccessfulCollection.resultCode,'replay');assert.equal(result.candidate.state,'unavailable');assert.equal(result.financialVerification,'not_assessed');assert.deepEqual(Object.keys(result.latestAttempt).sort(),['finishedAt','from','resultCode','startedAt','state','to']);assert.equal((await rpc(f.db,A)).state,'not_configured');
 for(const role of ['authenticated','anon'])await assert.rejects(f.db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);await tx.query('SELECT * FROM ingest_v1.sync_attempts');}),/permission/);
 await assert.rejects(f.db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE anon');await tx.query('SELECT public.shopify_connection_status($1)',[scope.storeId]);}),/permission/);
 }finally{await f.close();}
});
test('intake journal grants cannot forge timestamps, terminal insert, cross-store writes or delete history',async()=>{
 const f=await fixture();try{
 for(const [q,args] of [["INSERT INTO ingest_v1.sync_attempts(store_id,date_from,date_to) VALUES($1,'2026-09-17','2026-09-17')",[A]],["INSERT INTO ingest_v1.sync_attempts(store_id,date_from,date_to,state) VALUES($1,'2026-09-17','2026-09-17','completed')",[scope.storeId]],["INSERT INTO ingest_v1.sync_attempts(store_id,date_from,date_to,started_at) VALUES($1,'2026-09-17','2026-09-17','2020-01-01')",[scope.storeId]],['DELETE FROM ingest_v1.sync_attempts',[]]])await assert.rejects(f.restricted.transaction(tx=>tx.query(q,args)));
 const id=await f.journal.begin();const row=(await f.db.query('SELECT * FROM ingest_v1.sync_attempts WHERE id=$1',[id])).rows[0];assert.equal(row.state,'running');assert.equal(row.finished_at,null);assert.equal(row.result_code,null);
 }finally{await f.close();}
});
test('intake failure and finish-ack failure never retry; journal failure prevents intake',async()=>{
 const f=await fixture();try{let calls=0;const service=createJournaledOperatorSyncService({scope,journal:f.journal,inspectCandidate:async()=>inspected(),runIntake:async()=>{calls++;throw Error('private-secret');}});const state=await service.run();assert.equal(state.lastAttempt.state,'unconfirmed');assert.equal(state.durableHistory.latestAttempt.state,'unconfirmed');assert.ok(!JSON.stringify(state).includes('private-secret'));await service.run();assert.equal(calls,1);}finally{await f.close();}
 const g=await fixture();try{let calls=0;const uncertain={...g.journal,finish:async(...args)=>{await g.journal.finish(...args);throw Error('lostack');}};const s=createJournaledOperatorSyncService({scope,journal:uncertain,inspectCandidate:async()=>inspected(),runIntake:async()=>{calls++;return receipt();}});const r=await s.run();assert.equal(r.lastAttempt.state,'unconfirmed');assert.equal(r.durableHistory.latestAttempt.state,'completed');assert.equal(r.retryBlocked,true);await s.run();assert.equal(calls,1);}finally{await g.close();}
 const broken={scope,latest:async()=>{throw Error('secret');},begin:()=>assert.fail(),finish:()=>assert.fail()};const s=createJournaledOperatorSyncService({scope,journal:broken,inspectCandidate:async()=>inspected(),runIntake:()=>assert.fail()});assert.equal((await s.run()).retryBlocked,true);
});
test('malformed intake success cannot be sealed completed; lost start acknowledgement never invokes intake',async()=>{
 for(const bad of [{...receipt(),batchId:'secret'}, {...receipt(),mappingState:'secret'}]){
 const f=await fixture();try{const state=await createJournaledOperatorSyncService({scope,journal:f.journal,inspectCandidate:async()=>inspected(),runIntake:async()=>bad}).run();assert.equal(state.lastAttempt.state,'unconfirmed');assert.equal(state.durableHistory.latestAttempt.state,'unconfirmed');}finally{await f.close();}
 }
 const f=await fixture();try{const journal={...f.journal,begin:async()=>{await f.journal.begin();throw Error('lost start ack');}};const result=await createJournaledOperatorSyncService({scope,journal,inspectCandidate:async()=>inspected(),runIntake:()=>assert.fail('no intake until start acknowledged')}).run();assert.equal(result.durableHistory.latestAttempt.state,'running');assert.equal(result.lastAttempt.state,'unconfirmed');assert.equal(result.retryBlocked,true);}finally{await f.close();}
});
test('schema proposal refuses wrong store context or disabled source RLS atomically',async()=>{
 for(const tamper of ["UPDATE stores SET timezone='UTC' WHERE id='56d92f8a-746e-4b4f-b408-81fc98c4aa17'",'ALTER TABLE ingest_v1.heads DISABLE ROW LEVEL SECURITY']){
 const {db}=await setup();try{await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(tamper);await assert.rejects(db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql')));await db.exec('ROLLBACK');assert.equal((await db.query("SELECT to_regclass('ingest_v1.sync_attempts') relation")).rows[0].relation,null);}finally{await db.close();}
 }
});
test('journal/controller periods must match; optional journal absence retains process-only behavior',async()=>{
 const options={scope,inspectCandidate:async()=>inspected(),runIntake:async()=>receipt()};
 assert.throws(()=>createJournaledOperatorSyncService({...options,journal:{scope:{...scope,to:'2026-09-18'},begin(){},finish(){},latest(){}}}),/unavailable/);
 assert.equal((await createJournaledOperatorSyncService(options).status()).historyPersistence,'process_only');
});
test('member status counts come from the scoped candidate without returning source payload',async()=>{
 const f=await fixture();try{
 await f.db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,scope.storeId]);
 const payload={source:{orders:[{id:'synthetic-order',refunds:[{},{}],privateMarker:'not-for-browser'}]},mapped:{events:[],excluded:[{reason:'TEST_ORDER'}]}};
 const b=(await f.db.query("INSERT INTO ingest_v1.batches(store_id,date_from,date_to,fingerprint,mapping_state,payload) VALUES($1,$2,$3,$4,'mapped_for_review',$5) RETURNING id",[scope.storeId,scope.from,scope.to,'a'.repeat(64),JSON.stringify(payload)])).rows[0].id;
 await f.db.query('INSERT INTO ingest_v1.heads(store_id,date_from,date_to,batch_id,needs_recheck) VALUES($1,$2,$3,$4,true)',[scope.storeId,scope.from,scope.to,b]);
 const id=await f.journal.begin();await f.journal.finish(id,{state:'completed',resultCode:'replay'});
 const result=await rpc(f.db,scope.storeId);assert.equal(result.candidate.orderCount,1);assert.equal(result.candidate.refundCount,2);assert.equal(result.candidate.mappedEventCount,0);assert.equal(result.candidate.testExcludedCount,1);assert.equal(result.candidate.state,'needs_recheck');assert.ok(!JSON.stringify(result).includes('privateMarker'));
 }finally{await f.close();}
});
test('journal reads calendar dates as text, avoiding local-timezone conversion to the previous UTC day',async()=>{
 const journal=createDurableSyncJournal({transaction:fn=>fn({query:async query=>{
 assert.match(query,/date_from::text AS date_from,date_to::text AS date_to/);
 return {rows:[{id:'11111111-1111-4111-8111-111111111111',state:'completed',date_from:'2026-09-17',date_to:'2026-09-17',started_at:new Date('2026-09-17T15:31:07Z'),finished_at:new Date('2026-09-17T15:31:09Z'),result_code:'replay'}]};
 }})},{scope});
 const result=await journal.latest();assert.equal(result.from,'2026-09-17');assert.equal(result.to,'2026-09-17');
});
