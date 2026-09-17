import test from 'node:test';import assert from 'node:assert/strict';
import {nightlyPlan} from './nightly-plan.mjs';
import {parseNightlyArguments} from './nightly-development.mjs';
import {INTAKE_TARGET} from './intake-runtime.mjs';
test('London 02:00 moves with DST and admits only the scheduled minute',()=>{
 for(const [at,wanted] of [['2026-09-17T01:00:00Z','2026-09-17T01:00:00.000Z'],['2026-12-17T02:00:00Z','2026-12-17T02:00:00.000Z'],['2026-03-29T01:00:00Z','2026-03-29T01:00:00.000Z'],['2026-10-25T02:00:00Z','2026-10-25T02:00:00.000Z']]){const r=nightlyPlan(at,'Europe/London');assert.equal(r.scheduledAt,wanted);assert.equal(r.due,true);}
 assert.equal(nightlyPlan('2026-09-17T00:59:59Z','Europe/London').due,false);
 assert.equal(nightlyPlan('2026-09-17T01:00:59Z','Europe/London').due,true);
 assert.equal(nightlyPlan('2026-09-17T01:01:00Z','Europe/London').due,false);
 assert.equal(nightlyPlan('2026-09-17T15:00:00Z','Europe/London').due,false);
});
test('missing local 02:00 chooses next valid minute; repeated 02:00 only first occurrence',()=>{
 assert.equal(nightlyPlan('2026-03-08T07:00:00Z','America/New_York').due,true);
 assert.equal(nightlyPlan('2026-10-25T00:00:00Z','Europe/Berlin').due,true);
 assert.equal(nightlyPlan('2026-10-25T01:00:00Z','Europe/Berlin').due,false);
 assert.throws(()=>nightlyPlan('nonsense','Europe/London'));assert.throws(()=>nightlyPlan(new Date(),'not-a-timezone'));
});
test('CLI defaults read only and explicit tick requires exact target',()=>{
 assert.equal(parseNightlyArguments(['--config','private']).mode,'check');assert.throws(()=>parseNightlyArguments(['--config','private','--tick']));
 assert.equal(parseNightlyArguments(['--config','private','--tick','--confirm-target',`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`]).mode,'tick');
});
