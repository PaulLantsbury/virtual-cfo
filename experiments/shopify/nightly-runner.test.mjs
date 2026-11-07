import test from 'node:test';import assert from 'node:assert/strict';
import {setup,sql,A} from './finance-fixture.mjs';import {INTAKE_TARGET as target} from './intake-runtime.mjs';import {createNightlyRunner} from './nightly-runner.mjs';
const scope={storeId:target.storeId,from:'2026-09-17',to:'2026-09-17'};
const now=()=>new Date('2026-09-17T01:00:10Z');
const receipt=()=>({...scope,status:'replay',batchId:'11111111-1111-4111-8111-111111111111',coverageCertified:false,reviewRequired:true,financeImported:false});
async function fixture(){const {db}=await setup();await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));await db.exec(sql('proposals/shopify-nightly-claims-2026-09-17.sql'));const restricted={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');return fn(tx);})};return {db,restricted};}
test('concurrent ticks and recreated runner collect at most once per local day, later day allowed',async()=>{
 const f=await fixture();try{let calls=0;const options={db:f.restricted,scope,now,runIntake:async()=>{calls++;return receipt();}};
 const results=await Promise.all([createNightlyRunner(options).tick(),createNightlyRunner(options).tick()]);assert.equal(calls,1);assert.deepEqual(results.map(x=>x.state).sort(),['already_claimed','completed']);
 assert.equal((await createNightlyRunner({...options,now:()=>new Date('2026-09-17T01:14:59Z')}).tick()).state,'already_claimed');
 const next=await createNightlyRunner({...options,now:()=>new Date('2026-09-18T01:00:10Z')}).tick();assert.equal(next.state,'completed');assert.equal(calls,2);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM ingest_v1.sync_attempts')).rows[0].n,2);
 }finally{await f.db.close();}
});
test('failure preserves financial rows and blocks same and later day; no retries or leaked exception',async()=>{
 const f=await fixture();try{const before=JSON.stringify((await f.db.query('SELECT * FROM orders ORDER BY id')).rows);let calls=0;const options={db:f.restricted,scope,now,runIntake:async()=>{calls++;throw Error('secret');}};
 await assert.rejects(createNightlyRunner(options).tick(),e=>!e.message.includes('secret'));
 assert.equal((await createNightlyRunner(options).tick()).state,'already_claimed');
 await assert.rejects(createNightlyRunner({...options,now:()=>new Date('2026-09-18T01:00:00Z')}).tick());assert.equal(calls,1);
 assert.equal(JSON.stringify((await f.db.query('SELECT * FROM orders ORDER BY id')).rows),before);
 }finally{await f.db.close();}
});
test('lost daily claim acknowledgement prevents intake and reservation survives restart',async()=>{
 const f=await fixture();try{const uncertain={transaction:async fn=>{await f.restricted.transaction(fn);throw Error('lost ack');}};
 await assert.rejects(createNightlyRunner({db:uncertain,scope,now,runIntake:()=>assert.fail()}).tick());
 assert.equal((await createNightlyRunner({db:f.restricted,scope,now,runIntake:()=>assert.fail()}).tick()).state,'already_claimed');
 }finally{await f.db.close();}
});
test('off-minute does no DB or source work; grants forbid cross-store, terminal insert, timestamp tamper and deletes',async()=>{
 assert.equal((await createNightlyRunner({db:{transaction:()=>assert.fail()},scope,now:()=>new Date('2026-09-17T15:00:00Z'),runIntake:()=>assert.fail()}).tick()).state,'not_due');
 const f=await fixture();try{
 for(const role of ['anon','authenticated'])await assert.rejects(f.db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);await tx.query('SELECT * FROM ingest_v1.nightly_claims');}));
 for(const q of [`INSERT INTO ingest_v1.nightly_claims(store_id,local_date,timezone,scheduled_at,date_from,date_to) VALUES('${A}','2026-09-17','Europe/London','2026-09-17T01:00:00Z','2026-09-17','2026-09-17')`,`INSERT INTO ingest_v1.nightly_claims(state) VALUES('completed')`,`UPDATE ingest_v1.nightly_claims SET started_at=now()`,`DELETE FROM ingest_v1.nightly_claims`])await assert.rejects(f.restricted.transaction(tx=>tx.query(q)));
 }finally{await f.db.close();}
});
test('malformed receipt stays unconfirmed; lost durable finish acknowledgements never retry writes or intake',async()=>{
 for(const variant of ['bad-receipt','journal-finish','claim-finish']){
  const f=await fixture();try{let calls=0,finishes=0;const wrapped={transaction:async fn=>{
   let lost=false;const result=await f.restricted.transaction(tx=>fn({query:async(q,args)=>{
    const r=await tx.query(q,args);if((variant==='journal-finish'&&q.startsWith('UPDATE ingest_v1.sync_attempts'))||(variant==='claim-finish'&&q.startsWith('UPDATE ingest_v1.nightly_claims'))){finishes++;lost=true;}return r;
   }}));if(lost)throw Error('lost ack');return result;
  }};
  await assert.rejects(createNightlyRunner({db:wrapped,scope,now,runIntake:async()=>{calls++;return {...receipt(),...(variant==='bad-receipt'?{mappingState:'unsafe'}:{})};}}).tick());
  assert.equal((await createNightlyRunner({db:f.restricted,scope,now,runIntake:()=>assert.fail()}).tick()).state,'already_claimed');assert.equal(calls,1);assert.equal(finishes,variant==='bad-receipt'?0:1);
  const state=(await f.db.query('SELECT state FROM ingest_v1.nightly_claims')).rows[0].state;assert.equal(state,variant==='claim-finish'?'completed':'unconfirmed');
  }finally{await f.db.close();}
 }
});
