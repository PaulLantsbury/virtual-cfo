import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {prepareInitialSeedCandidate} from './initial-seed-candidate.mjs';
import {createStagingRehearsal,stagingFingerprints,readStagingProfit} from './staging-rehearsal.mjs';
const reviewerId='10000000-0000-4000-8000-000000000001';
test('fixed-month candidate rehearses rollback and local commit with one correct dated snapshot',async()=>{
 const p=await prepareInitialSeedCandidate({reviewerId,observedAt:'2026-11-05T18:00:00Z'});assert.equal(p.remoteApplied,false);assert.equal(p.reviewerBindingVerified,false);assert.match(p.rehearsalSql,/ROLLBACK;\s*$/);assert.match(p.commitCandidateSql,/COMMIT;\s*$/);
 const h=await createStagingRehearsal({reviewerId});try{
 await h.db.exec(await readFile(new URL('./staging-snapshot-schema.sql',import.meta.url),'utf8'));
 const before=await stagingFingerprints(h.db);await h.db.query("SELECT set_config('night_scout.synthetic_target_verified','v2-isolated-staging-reviewed',false)");
 await h.db.exec('ALTER TABLE finance_v1.reporting_snapshots DISABLE ROW LEVEL SECURITY');
 await assert.rejects(h.db.exec(p.rehearsalSql),/snapshot schema\/security contract differs/i);await h.db.exec('ROLLBACK; ALTER TABLE finance_v1.reporting_snapshots ENABLE ROW LEVEL SECURITY');
 await h.db.exec('GRANT SELECT ON finance_v1.reporting_snapshots TO PUBLIC');
 await assert.rejects(h.db.exec(p.rehearsalSql),/snapshot schema\/security contract differs/i);await h.db.exec('ROLLBACK; REVOKE SELECT ON finance_v1.reporting_snapshots FROM PUBLIC');
 await h.db.exec(p.rehearsalSql);assert.equal(await stagingFingerprints(h.db),before);assert.equal((await h.db.query('SELECT * FROM finance_v1.reporting_snapshots')).rows.length,0);
 await h.db.exec(p.commitCandidateSql);const rows=(await h.db.query('SELECT * FROM finance_v1.reporting_snapshots')).rows;assert.equal(rows.length,1);assert.equal(new Date(rows[0].source_as_of).toISOString(),'2025-02-01T00:00:00.000Z');assert.equal(rows[0].source_basis,'synthetic-local');assert.equal(rows[0].profit_version_id,p.sourceSnapshot.profit_version_id);
 const r=await readStagingProfit(h,{storeId:p.sourceSnapshot.store_id,currency:'GBP',from:'2025-01-01',to:'2025-01-31',versionId:p.sourceSnapshot.profit_version_id});assert.equal(r.readError,null);assert.equal(r.result.operatingProfit.value,197602);
 }finally{await h.db.close();}
});
test('no reviewer is inferred',async()=>{await assert.rejects(prepareInitialSeedCandidate(),/reviewer UUID/);});
