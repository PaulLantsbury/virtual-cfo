import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,U} from './finance-fixture.mjs';
import {INTAKE_TARGET} from './intake-runtime.mjs';
test('proposed membership requires existing account, adds only fixed store once and grants no reviewer authority',async()=>{
 const {db}=await setup();
 try{
 await db.exec(sql('proposed/ingest_v1_review_restoration.sql'));
 await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));
 await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));
 const before=(await db.query('SELECT * FROM public.store_memberships ORDER BY user_id,store_id')).rows;
 const reviews=(await db.query('SELECT * FROM ingest_v1.review_authorizations ORDER BY store_id,reviewer_id')).rows;
 await assert.rejects(db.exec(sql('proposals/shopify-status-member-2026-09-17.sql')),/existing staging account/);await db.exec('ROLLBACK');
 await db.query("SELECT set_config('night_scout.approved_member_id',$1,false)",[U]);
 await db.exec(sql('proposals/shopify-status-member-2026-09-17.sql'));await db.exec(sql('proposals/shopify-status-member-2026-09-17.sql'));
 const after=(await db.query('SELECT * FROM public.store_memberships ORDER BY user_id,store_id')).rows;
 assert.equal(after.length,before.length+1);assert.deepEqual(after.filter(r=>r.store_id!==INTAKE_TARGET.storeId),before);
 assert.deepEqual(after.filter(r=>r.store_id===INTAKE_TARGET.storeId),[{user_id:U,store_id:INTAKE_TARGET.storeId}]);
 assert.deepEqual((await db.query('SELECT * FROM ingest_v1.review_authorizations ORDER BY store_id,reviewer_id')).rows,reviews);
 }finally{await db.close();}
});
