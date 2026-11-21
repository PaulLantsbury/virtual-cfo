// Independent recovery/access checks; disposable PostgreSQL, no live writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,U} from './finance-fixture.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
import {createDurableSyncJournal,createJournaledOperatorSyncService} from './durable-sync-journal.mjs';
const scope={storeId:target.storeId,from:'2026-09-17',to:'2026-09-17'};
const inspected=()=>({...scope,projectRef:target.projectRef,status:'unavailable',observedAt:'2026-09-17T12:00:00Z',retainedBatchCount:0,coverageCertified:false,candidateWriteAttempted:false,reviewRequired:true,financialImportStatus:'not_assessed'});
async function fixture(){
 const {db}=await setup();await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));
 const adapter={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');return fn(tx);})};
 return {db,journal:createDurableSyncJournal(adapter,{scope})};
}
test('lost durable-start acknowledgement never starts intake and the unresolved row blocks a recreated operator',async()=>{
 const {db,journal}=await fixture();try{
 let starts=0,intakes=0;const uncertainStart={...journal,begin:async()=>{starts++;await journal.begin();throw Error('private DB acknowledgement lost');}};
 const options={scope,inspectCandidate:async()=>inspected(),runIntake:async()=>{intakes++;assert.fail('No intake after unknown journal start');}};
 const result=await createJournaledOperatorSyncService({...options,journal:uncertainStart}).run();
 assert.equal(starts,1);assert.equal(intakes,0);assert.equal(result.retryBlocked,true);assert.equal(result.durableHistory.latestAttempt.state,'running');assert.doesNotMatch(JSON.stringify(result),/private DB/);
 const restarted=await createJournaledOperatorSyncService({...options,journal}).run();assert.equal(restarted.retryBlocked,true);assert.equal(intakes,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM ingest_v1.sync_attempts')).rows[0].n,1);
 }finally{await db.close();}
});
test('revoking membership immediately removes durable status access without exposing journal or changing history',async()=>{
 const {db,journal}=await fixture();try{
 await db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,scope.storeId]);const id=await journal.begin();await journal.finish(id,{state:'completed',resultCode:'replay'});
 const read=()=>db.transaction(async tx=>{await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[U]);await tx.exec('SET LOCAL ROLE authenticated');return (await tx.query('SELECT public.shopify_connection_status($1) value',[scope.storeId])).rows[0].value;});
 const before=await journal.latest(),result=await read();assert.equal(result.latestAttempt.resultCode,'replay');assert.equal(result.financialVerification,'not_assessed');
 assert.deepEqual(Object.keys(result).sort(),['candidate','financialVerification','latestAttempt','latestSuccessfulCollection','state','storeId']);
 await db.query('DELETE FROM store_memberships WHERE user_id=$1 AND store_id=$2',[U,scope.storeId]);await assert.rejects(read(),/Store membership required/);assert.deepEqual(await journal.latest(),before);
 }finally{await db.close();}
});
