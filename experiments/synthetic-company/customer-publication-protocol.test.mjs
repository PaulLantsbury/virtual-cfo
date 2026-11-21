import test from 'node:test';import assert from 'node:assert/strict';
import {supplementalDigest as hash} from './supplemental-reader.mjs';
import {prepareCustomerPublicationPlan,createCustomerPublicationProtocol} from './customer-publication-protocol.mjs';
import {setupCustomerPublicationFixture} from './customer-publication-fixture.mjs';
async function configure(h){
 await h.db.exec('CREATE TABLE publication_rehearsal_receipts(protocol_hash text PRIMARY KEY,body jsonb NOT NULL)');
 const seals=async(tx,store)=>(await tx.query('SELECT to_jsonb(s) value FROM finance_history_v2.seals s WHERE store_id=$1 ORDER BY snapshot_id',[store])).rows.map(r=>r.value);
 const protectedState=async(tx,store)=>{
  const snapshots=(await tx.query('SELECT to_jsonb(b) value FROM finance_review_supplement_v1.snapshots b WHERE store_id=$1 ORDER BY snapshot_id',[store])).rows.map(r=>r.value);
  const financial={};for(const table of ['seals','invalidations','version_heads','correction_versions','correction_selections'])financial[table]=(await tx.query(`SELECT to_jsonb(t) value FROM finance_history_v2.${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.value);
  return {snapshots,financial};
 };
 const fingerprint=hash(await seals(h.db,h.base.body.scope.storeId)),protectedStateHash=hash(await protectedState(h.db,h.base.body.scope.storeId));
 const control={failAt:null,lostAck:false,readbackFails:false,writes:0};
 const port={purpose:'disposable-local-rehearsal',financialSeals:seals,protectedState,
  authority:async(tx,expected)=>{
   const {scope:s,financialVersionId:v,salesRevision,costRevision}=expected;
   const rows=(await tx.query('SELECT snapshot_id FROM finance_history_v2.seals z WHERE snapshot_id=$1 AND store_id=$2 AND date_from=$3 AND date_to=$4 AND sales_revision=$5 AND cost_revision=$6 AND NOT EXISTS(SELECT 1 FROM finance_history_v2.invalidations i WHERE i.snapshot_id=z.snapshot_id) AND NOT EXISTS(SELECT 1 FROM finance_history_v2.version_heads h WHERE h.store_id=z.store_id AND h.date_from=z.date_from AND h.date_to=z.date_to)',[v,s.storeId,s.from,s.to,salesRevision,costRevision])).rows;
   return rows.length===1?expected:{state:'unavailable'};
  },
  transaction:async fn=>{const result=await h.db.transaction(fn);if(control.lostAck)throw Error('Lost ACK after committed transaction');return result;},
  readback:fn=>{if(control.readbackFails)throw Error('Readback unavailable');return h.db.transaction(fn);},
  readReceipt:async(tx,key)=>(await tx.query('SELECT body FROM publication_rehearsal_receipts WHERE protocol_hash=$1',[key])).rows[0]?.body??null,
  appendReceipt:async(tx,r)=>{await tx.query('INSERT INTO publication_rehearsal_receipts VALUES($1,$2::jsonb)',[r.protocolHash,JSON.stringify(r)]);},
  checkpoint:async name=>{if(name==='postinsert')control.writes++;if(name===control.failAt)throw Error('Injected local failure');},
 };
 const pin=input=>{const p=prepareCustomerPublicationPlan(input,fingerprint,protectedStateHash);return {...p.binding,protocolHash:p.protocolHash};};
 return {control,port,execute:(input=h.input)=>createCustomerPublicationProtocol(port).execute(input,pin(input)),pin,fingerprint,protectedStateHash};
}
const count=async(db,table)=>(await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;
test('production-shaped local protocol inserts version+selection+receipt atomically and exact replay writes nothing',async()=>{const h=await setupCustomerPublicationFixture();try{const p=await configure(h),before=hash(h.input.baseRows);assert.equal((await p.execute()).state,'applied-confirmed');assert.equal((await h.read()).state,'supported');assert.equal(await count(h.db,'publication_rehearsal_receipts'),1);assert.equal((await p.execute()).state,'already-applied');assert.equal(p.control.writes,1);assert.equal(hash(h.input.baseRows),before);assert.equal(await count(h.db,'finance_review_supplement_v1.snapshots'),48);}finally{await h.db.close();}});
test('preinsert postinsert precommit failures rollback all new writes and do not retry',async()=>{const h=await setupCustomerPublicationFixture();try{const p=await configure(h);for(const stage of ['preinsert','postinsert','precommit']){p.control.failAt=stage;assert.equal((await p.execute()).state,'not-applied-readback-confirmed');for(const table of ['versions','selections'])assert.equal(await count(h.db,'finance_customer_sidecar_v1.'+table),0);assert.equal(await count(h.db,'publication_rehearsal_receipts'),0);}assert.equal((await h.read()).state,'unavailable');}finally{await h.db.close();}});
test('lost commit ACK is resolved by independent exact readback, no blind second write; unavailable readback stays unknown',async()=>{const h=await setupCustomerPublicationFixture();try{const p=await configure(h);p.control.lostAck=true;assert.equal((await p.execute()).state,'applied-confirmed-after-uncertain-ack');assert.equal(p.control.writes,1);p.control.readbackFails=true;const r=await p.execute();assert.equal(r.state,'outcome-unknown');assert.equal(r.retryAllowed,false);assert.equal(p.control.writes,1);}finally{await h.db.close();}});
test('append-only withdrawal preserves archive and denies reader; replay cannot restore withdrawn selection',async()=>{const h=await setupCustomerPublicationFixture();try{const p=await configure(h);await p.execute();const recovery={...h.input,selections:[],existingSidecars:[{versionId:h.side.versionId,body:h.side.body}],existingSelections:h.input.selections,withdrawals:[{baseBodyHash:h.base.bodyHash,sidecarVersionId:h.side.versionId,withdrawnBy:h.reviewer,withdrawnAt:'2026-11-21T11:00:00Z',reasonCode:'owner-withdrawal'}]};assert.equal((await p.execute(recovery)).state,'applied-confirmed');assert.equal((await h.read()).state,'unavailable');assert.equal(await count(h.db,'finance_customer_sidecar_v1.versions'),1);assert.equal(await count(h.db,'finance_customer_sidecar_v1.selections'),1);assert.equal((await p.execute(recovery)).state,'already-applied');assert.equal((await p.execute()).state,'conflict');assert.equal(await count(h.db,'finance_review_supplement_v1.snapshots'),48);}finally{await h.db.close();}});
test('changed artifact pin or prior selection actor/time and unrelated financial seals fail closed',async()=>{const h=await setupCustomerPublicationFixture();try{const p=await configure(h),pin=p.pin(h.input),protocol=createCustomerPublicationProtocol(p.port);await assert.rejects(protocol.execute(h.input,{...pin,sourceRevision:'b'.repeat(40)}));await h.db.query('UPDATE finance_history_v2.seals SET sales_revision=$1 WHERE snapshot_id=$2',['f'.repeat(64),h.input.baseRows[0].body.financialVersionId]);const result=await protocol.execute(h.input,pin);assert.equal(result.state,'outcome-unknown');assert.equal(await count(h.db,'finance_customer_sidecar_v1.versions'),0);}finally{await h.db.close();}});

test('withdrawal refuses a forged archived selecting actor or instant even with a self-consistent new candidate pin',async()=>{const h=await setupCustomerPublicationFixture();try{const p=await configure(h);await p.execute();for(const delta of [{selectedBy:'61000000-0000-4000-8000-000000000002'},{selectedAt:'2026-11-21T09:59:59Z'}]){const prior={...h.input.selections[0],...delta};const recovery={...h.input,selections:[],existingSidecars:[{versionId:h.side.versionId,body:h.side.body}],existingSelections:[prior],withdrawals:[{baseBodyHash:h.base.bodyHash,sidecarVersionId:h.side.versionId,withdrawnBy:h.reviewer,withdrawnAt:'2026-11-21T11:00:00Z',reasonCode:'owner-withdrawal'}]};assert.equal((await p.execute(recovery)).state,'conflict');assert.equal(await count(h.db,'finance_customer_sidecar_v1.withdrawals'),0);}assert.equal((await h.read()).state,'supported');}finally{await h.db.close();}});

test('fresh authority checks reject invalidated or replaced financial scope even when new indexed-state fingerprint is supplied',async()=>{
 for(const mutation of ['invalidation','correction']){const h=await setupCustomerPublicationFixture();try{
  const p=await configure(h),s=h.base.body.scope;
  if(mutation==='invalidation')await h.db.query('INSERT INTO finance_history_v2.invalidations VALUES($1)',[h.side.body.financialVersionId]);
  else await h.db.query('INSERT INTO finance_history_v2.version_heads VALUES($1,$2,$3,$4,$5)',[s.storeId,s.from,s.to,'99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000002']);
  const currentStateHash=hash(await p.port.protectedState(h.db,s.storeId));
  const plan=prepareCustomerPublicationPlan(h.input,p.fingerprint,currentStateHash),pin={...plan.binding,protocolHash:plan.protocolHash};
  const result=await createCustomerPublicationProtocol(p.port).execute(h.input,pin);
  assert.equal(result.state,'outcome-unknown');assert.equal(result.retryAllowed,false);assert.equal(await count(h.db,'finance_customer_sidecar_v1.versions'),0);assert.equal(await count(h.db,'publication_rehearsal_receipts'),0);
 }finally{await h.db.close();}}
});
test('wrong actual snapshot mapping is refused before insert; omitted/mismatched durable receipt cannot certify complete state',async()=>{const h=await setupCustomerPublicationFixture();try{const p=await configure(h),changed=structuredClone(h.input),target=changed.baseSnapshots.find(s=>s.baseBodyHash===h.base.bodyHash);target.baseSnapshotId='99000000-0000-4000-8000-000000000003';const r=await p.execute(changed);assert.equal(r.state,'outcome-unknown');assert.equal(await count(h.db,'finance_customer_sidecar_v1.versions'),0);await p.execute();await h.db.exec('DELETE FROM publication_rehearsal_receipts');assert.equal((await p.execute()).state,'conflict');assert.equal(p.control.writes,1);}finally{await h.db.close();}});

test('incorrect durable receipt port output is detected before commit and rolls the candidate back',async()=>{const h=await setupCustomerPublicationFixture();try{const p=await configure(h),append=p.port.appendReceipt;p.port.appendReceipt=(tx,r)=>append(tx,{...r,candidateHash:'f'.repeat(64)});assert.equal((await p.execute()).state,'not-applied-readback-confirmed');assert.equal(await count(h.db,'finance_customer_sidecar_v1.versions'),0);assert.equal(await count(h.db,'finance_customer_sidecar_v1.selections'),0);assert.equal(await count(h.db,'publication_rehearsal_receipts'),0);}finally{await h.db.close();}});


test('source-correction withdrawal works after financial invalidation using fresh protected baseline without reauthorizing the archived result',async()=>{const h=await setupCustomerPublicationFixture();try{
 const p=await configure(h);assert.equal((await p.execute()).state,'applied-confirmed');
 const archivesBefore=hash((await h.db.query('SELECT to_jsonb(v) value FROM finance_customer_sidecar_v1.versions v')).rows),selectionsBefore=hash((await h.db.query('SELECT to_jsonb(s) value FROM finance_customer_sidecar_v1.selections s')).rows);
 await h.db.query('INSERT INTO finance_history_v2.invalidations VALUES($1)',[h.side.body.financialVersionId]);assert.equal((await h.read()).state,'unavailable');
 const recovery={...h.input,selections:[],existingSidecars:[{versionId:h.side.versionId,body:h.side.body}],existingSelections:h.input.selections,withdrawals:[{baseBodyHash:h.base.bodyHash,sidecarVersionId:h.side.versionId,withdrawnBy:h.reviewer,withdrawnAt:'2026-11-21T11:00:00Z',reasonCode:'source-correction'}]};
 const currentProtected=hash(await p.port.protectedState(h.db,h.base.body.scope.storeId)),plan=prepareCustomerPublicationPlan(recovery,p.fingerprint,currentProtected),pin={...plan.binding,protocolHash:plan.protocolHash};
 const protocol=createCustomerPublicationProtocol(p.port);assert.equal((await protocol.execute(recovery,pin)).state,'applied-confirmed');assert.equal((await protocol.execute(recovery,pin)).state,'already-applied');
 assert.equal(await count(h.db,'finance_customer_sidecar_v1.withdrawals'),1);assert.equal((await h.read()).state,'unavailable');assert.equal(hash((await h.db.query('SELECT to_jsonb(v) value FROM finance_customer_sidecar_v1.versions v')).rows),archivesBefore);assert.equal(hash((await h.db.query('SELECT to_jsonb(s) value FROM finance_customer_sidecar_v1.selections s')).rows),selectionsBefore);assert.equal(await count(h.db,'finance_review_supplement_v1.snapshots'),48);
 const publicationPlan=prepareCustomerPublicationPlan(h.input,p.fingerprint,currentProtected);assert.equal((await protocol.execute(h.input,{...publicationPlan.binding,protocolHash:publicationPlan.protocolHash})).state,'outcome-unknown');
 }finally{await h.db.close();}});

test('disposable readback rejects persisted selection and withdrawal instants that differ by a microsecond', async () => {
 const h = await setupCustomerPublicationFixture();
 try {
  const p = await configure(h);
  const transaction = p.port.transaction;
  function offsetPersistedInstant(table, index, instant) {
   p.port.transaction = callback => transaction(tx => callback({
    exec: tx.exec.bind(tx),
    query: (sql, parameters) => {
     if (sql.startsWith('INSERT INTO finance_customer_sidecar_v1.' + table)) {
      const changed = [...parameters];
      changed[index] = instant;
      return tx.query(sql, changed);
     }
     return tx.query(sql, parameters);
    },
   }));
  }
  offsetPersistedInstant('selections', 3, '2026-11-21T10:00:00.000001Z');
  assert.equal((await p.execute()).state, 'not-applied-readback-confirmed');
  assert.equal(await count(h.db, 'finance_customer_sidecar_v1.versions'), 0);
  assert.equal(await count(h.db, 'finance_customer_sidecar_v1.selections'), 0);
  assert.equal(await count(h.db, 'publication_rehearsal_receipts'), 0);

  p.port.transaction = transaction;
  assert.equal((await p.execute()).state, 'applied-confirmed');
  const withdrawal = {
   ...h.input,
   selections: [],
   existingSidecars: [{versionId: h.side.versionId, body: h.side.body}],
   existingSelections: h.input.selections,
   withdrawals: [{
    baseBodyHash: h.base.bodyHash,
    sidecarVersionId: h.side.versionId,
    withdrawnBy: h.reviewer,
    withdrawnAt: '2026-11-21T11:00:00Z',
    reasonCode: 'owner-withdrawal',
   }],
  };
  offsetPersistedInstant('withdrawals', 3, '2026-11-21T11:00:00.000001Z');
  assert.equal((await p.execute(withdrawal)).state, 'not-applied-readback-confirmed');
  assert.equal(await count(h.db, 'finance_customer_sidecar_v1.withdrawals'), 0);
  assert.equal(await count(h.db, 'publication_rehearsal_receipts'), 1);
  assert.equal((await h.read()).state, 'supported');
 } finally {
  await h.db.close();
 }
});
