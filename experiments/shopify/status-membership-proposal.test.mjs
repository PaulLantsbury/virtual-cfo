import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,U} from './finance-fixture.mjs';
import {INTAKE_TARGET} from './intake-runtime.mjs';
const proposal=sql('proposals/shopify-status-member-2026-09-17.sql');
async function fixture(){const {db}=await setup();await db.exec(sql('proposed/ingest_v1_review_restoration.sql'));await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));return db;}
test('membership proposal requires an existing account and changes only one fixed membership idempotently',async()=>{
 const db=await fixture();try{
 const before=(await db.query('SELECT * FROM store_memberships ORDER BY user_id,store_id')).rows;
 const reviewers=(await db.query('SELECT * FROM ingest_v1.review_authorizations ORDER BY store_id,reviewer_id')).rows;
 for(const id of ['', '80000000-0000-4000-8000-999999999999']){
  await db.query("SELECT set_config('night_scout.approved_member_id',$1,false)",[id]);await assert.rejects(db.exec(proposal),/verified existing staging account/);await db.exec('ROLLBACK');
  assert.deepEqual((await db.query('SELECT * FROM store_memberships ORDER BY user_id,store_id')).rows,before);
 }
 await db.query("SELECT set_config('night_scout.approved_member_id',$1,false)",[U]);await db.exec(proposal);await db.exec(proposal);
 const all=(await db.query('SELECT * FROM store_memberships ORDER BY user_id,store_id')).rows;
 assert.equal(all.length,before.length+1);assert.deepEqual(all.filter(r=>r.store_id!==INTAKE_TARGET.storeId),before);
 assert.deepEqual(all.filter(r=>r.store_id===INTAKE_TARGET.storeId),[{user_id:U,store_id:INTAKE_TARGET.storeId}]);
 assert.deepEqual((await db.query('SELECT * FROM ingest_v1.review_authorizations ORDER BY store_id,reviewer_id')).rows,reviewers);
 }finally{await db.close();}
});
