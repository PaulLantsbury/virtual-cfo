import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHistoryRehearsal,createHistoryService} from './history-rehearsal.mjs';
import {historyReleasePreflightQuery,prepareHistoryRelease} from './history-release-package.mjs';
const now=()=>new Date('2026-11-05T17:30:00Z');
test('private initial history artifact commits atomically beside occupied January and refuses drift/replay',async()=>{
 const h=await createHistoryRehearsal({now});
 try{
  await h.db.exec(await readFile(new URL('./staging-snapshot-schema.sql',import.meta.url),'utf8'));
  await h.db.exec('DROP SCHEMA finance_history_v2 CASCADE'); // Newly created disposable target only.
  const preflight=(await h.db.query(historyReleasePreflightQuery)).rows[0].preflight;
  const artifact=await prepareHistoryRelease({reviewerId:h.reviewerId,preflight,from:'2025-01-01',asOf:'2025-02-02',observedAt:now().toISOString(),now});
  assert.equal(artifact.remoteApplied,false);assert.equal(artifact.counts.seals,1);
  const drifted=artifact.rollbackSql.replace(preflight.protected['public.orders'],'0'.repeat(64));
  await assert.rejects(h.db.exec(drifted),/protected data changed/);await h.db.exec('ROLLBACK');
  assert.deepEqual((await h.db.query(historyReleasePreflightQuery)).rows[0].preflight,preflight);
  await h.db.exec(artifact.rollbackSql);assert.deepEqual((await h.db.query(historyReleasePreflightQuery)).rows[0].preflight,preflight);
  await h.db.exec(artifact.commitSql);
  const auth={auth:{getUser:async()=>({data:{user:{id:h.reviewerId,is_anonymous:false}}})}};
  const r=await createHistoryService(h.db,auth,{now}).read({storeId:h.storeId,currency:'GBP',from:'2025-01-01',to:'2025-01-31'},'Bearer valid');
  assert.equal(r.state,'supported');assert.equal(r.profit.operatingProfit,197602);
  await assert.rejects(h.db.exec(artifact.commitSql),/target|protected data changed/);
  await h.db.exec('ROLLBACK');
  assert.deepEqual((await h.db.query(historyReleasePreflightQuery)).rows[0].preflight.protected,preflight.protected);
 }finally{await h.db.close();}
});
