import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {prepareInitialSeedCandidate} from './initial-seed-candidate.mjs';import {createStagingRehearsal} from './staging-rehearsal.mjs';
import {createProfitReportingService} from '../financial-v1/profit-reporting-service.mjs';
const reviewerId='10000000-0000-4000-8000-000000000001';
const auth=id=>({auth:{getUser:async token=>token==='valid'?{data:{user:{id,is_anonymous:false}}}:{error:{message:'SECRET provider error'}}}});
test('seed snapshot through actual service authenticates and scopes metadata, redacts sources, invalidates safely',async()=>{
 const p=await prepareInitialSeedCandidate({reviewerId,observedAt:'2026-11-05T12:00:00Z'}),h=await createStagingRehearsal({reviewerId});
 try{
 await h.db.exec(await readFile(new URL('./staging-snapshot-schema.sql',import.meta.url),'utf8'));await h.db.query("SELECT set_config('night_scout.synthetic_target_verified','v2-isolated-staging-reviewed',false)");await h.db.exec(p.commitCandidateSql);
 const scope={storeId:p.sourceSnapshot.store_id,currency:'GBP',from:'2025-01-01',to:'2025-01-31'},policy={storeId:scope.storeId,sourceBasis:'synthetic-local',formulaVersion:'night-scout-v11-2026-10-30',profileVersion:'uk-gifts-v2'};
 const service=createProfitReportingService(h.db,auth(reviewerId),{snapshotPolicy:policy});
 const ready=await service.read(scope,'Bearer valid');assert.equal(ready.trustedSnapshot.state,'supported');assert.equal(ready.trustedSnapshot.verification,'canonical-current');assert.equal(ready.trustedSnapshot.metadata.providerFreshness,'unverified');assert.equal(ready.trustedSnapshot.metadata.sourceAsOf.slice(0,19),'2025-02-01T00:00:00');assert.equal(ready.report.operatingProfit.value,197602);
 const text=JSON.stringify(ready);for(const privateField of ['source_manifest','verified_by','manifest_digest','sales_revision','observed_line','journalIds','SECRET'])assert.ok(!text.includes(privateField),privateField);
 await assert.rejects(service.read(scope,'Bearer invalid'),/sign-in could not be verified/);
 await assert.rejects(createProfitReportingService(h.db,auth('10000000-0000-4000-8000-000000000002'),{snapshotPolicy:policy}).read(scope,'Bearer valid'),/membership required/);
 await assert.rejects(service.read({...scope,sourceBasis:'synthetic-local'},'Bearer valid'),/scope/);
 assert.equal((await createProfitReportingService(h.db,auth(reviewerId),{snapshotPolicy:{...policy,storeId:reviewerId}}).read(scope,'Bearer valid')).trustedSnapshot.state,'unavailable');
 await h.db.query('INSERT INTO finance_v1.reporting_snapshot_invalidations(snapshot_id,store_id,observed_at,reason) VALUES($1,$2,$3,$4)',[p.sourceSnapshot.snapshot_id,scope.storeId,'2026-11-05T12:01:00Z','private synthetic revision correction']);
 const invalid=await service.read(scope,'Bearer valid');assert.equal(invalid.trustedSnapshot.state,'unavailable');assert.equal(invalid.trustedSnapshot.metadata,null);assert.ok(!JSON.stringify(invalid).includes('private synthetic revision correction'));
 }finally{await h.db.close();}
});
