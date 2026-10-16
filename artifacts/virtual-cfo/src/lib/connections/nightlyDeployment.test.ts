import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentForStore,nightlyDeployment} from './nightlyDeployment.ts';

test('deployment acknowledgement belongs only to the exact staging project and store',()=>{
 const correct=`https://${nightlyDeployment.projectRef}.supabase.co`;
 assert.equal(deploymentForStore(correct,nightlyDeployment.storeId),nightlyDeployment);
 for(const url of [undefined,'bad-url','https://futkktdebdygsdrcknpr.supabase.co',`${correct}.example.com`,correct.replace('https:','http:'),`${correct}:8443`,correct.replace('https://','https://user:password@')])assert.equal(deploymentForStore(url,nightlyDeployment.storeId),null);
 for(const store of [null,undefined,'another-store'])assert.equal(deploymentForStore(correct,store),null);
});
test('acknowledgement is dated and explicitly limited to a fixed test period, not financial or overnight success',()=>{
 assert.equal(nightlyDeployment.acknowledgedOn,'2026-09-17');
 assert.equal(nightlyDeployment.reportFrom,nightlyDeployment.reportTo);
 assert.equal(nightlyDeployment.timezone,'Europe/London');
 assert.equal('lastSuccessfulRun' in nightlyDeployment,false);
 assert.equal('financialVerification' in nightlyDeployment,false);
});
test('first-run observation records failure without claiming automatic collection or freshness',()=>{
 const observation=deploymentForStore(`https://${nightlyDeployment.projectRef}.supabase.co`,nightlyDeployment.storeId)?.firstRunObservation;
 assert.equal(observation?.checkedOn,'2026-09-18');
 assert.equal(observation?.scheduledLocalDate,'2026-09-18');
 assert.equal(observation?.scheduledLocalTime,'02:00');
 assert.equal(observation?.outcome,'failed_before_collection');
 assert.equal(observation?.collectionRecorded,false);
 assert.equal(nightlyDeployment.scheduleVerification,'confirmed');
 assert.equal(nightlyDeployment.reportFrom,'2026-09-17');
 assert.equal(nightlyDeployment.reportTo,'2026-09-17');
});
