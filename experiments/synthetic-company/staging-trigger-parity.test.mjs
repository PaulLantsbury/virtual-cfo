import test from 'node:test';import assert from 'node:assert/strict';
import {createStagingRehearsal,stagingFingerprints} from './staging-rehearsal.mjs';
import {A,B,O} from '../shopify/finance-fixture.mjs';
async function head(db,store,batch){await db.query("INSERT INTO ingest_v1.batches(id,store_id,date_from,date_to,fingerprint,mapping_state,payload) VALUES($1,$2,'2026-08-01','2026-08-31',$3,'mapped_for_review','{}')",[batch,store,'a'.repeat(64)]);await db.query("INSERT INTO ingest_v1.heads VALUES($1,'2026-08-01','2026-08-31',$2,false)",[store,batch]);await db.query("INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,'2026-08-01','2026-08-31','GBP',true,'invented protected baseline','local test') ON CONFLICT(store_id,date_from,date_to) DO UPDATE SET sales_and_refunds_complete=true",[store]);}
test('matching installed protection invalidates only changed store and transaction rollback preserves all heads/coverage',async()=>{
 const h=await createStagingRehearsal();try{
 await head(h.db,A,'10000000-0000-4000-8000-000000000011');await head(h.db,B,'10000000-0000-4000-8000-000000000012');
 const before=await stagingFingerprints(h.db);
 await assert.rejects(h.db.transaction(async tx=>{
 await tx.query('UPDATE public.orders SET gross_sales=gross_sales+1 WHERE id=$1',[O]);
 const states=(await tx.query('SELECT c.store_id,c.sales_and_refunds_complete,h.needs_recheck FROM finance_v1.coverage_evidence c JOIN ingest_v1.heads h USING(store_id,date_from,date_to) ORDER BY c.store_id')).rows;
 assert.deepEqual(states.map(s=>[s.store_id,s.sales_and_refunds_complete,s.needs_recheck]),[[A,false,true],[B,true,false]]);
 throw Error('intentional local rollback');
 }),/intentional/);
 assert.equal(await stagingFingerprints(h.db),before);
 await assert.rejects(h.db.transaction(async tx=>{await tx.query("UPDATE public.stores SET timezone='UTC' WHERE id=$1",[A]);assert.equal((await tx.query('SELECT needs_recheck FROM ingest_v1.heads WHERE store_id=$1',[A])).rows[0].needs_recheck,true);assert.equal((await tx.query('SELECT sales_and_refunds_complete FROM finance_v1.coverage_evidence WHERE store_id=$1',[B])).rows[0].sales_and_refunds_complete,true);throw Error('intentional local rollback');}),/intentional/);
 assert.equal(await stagingFingerprints(h.db),before);
 }finally{await h.db.close();}
});
test('all five live canonical invalidation triggers are present, enabled, and use the protected existing functions',async()=>{
 const h=await createStagingRehearsal();try{
 const rows=(await h.db.query("SELECT t.tgname,t.tgenabled,p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgname=ANY($1) ORDER BY t.tgname",[['ingest_order_coverage','ingest_refund_coverage','ingest_order_evidence_coverage','ingest_refund_evidence_coverage','ingest_settings_coverage']])).rows;
 assert.equal(rows.length,5);assert.ok(rows.every(r=>r.tgenabled==='O'));assert.equal(rows.filter(r=>r.proname==='invalidate_source_change').length,4);assert.equal(rows.filter(r=>r.proname==='invalidate_store_settings').length,1);
 }finally{await h.db.close();}
});
