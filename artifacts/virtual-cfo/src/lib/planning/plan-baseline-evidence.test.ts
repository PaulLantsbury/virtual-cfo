import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPlanBaseline,planEvidenceWindow} from './plan-baseline-evidence.ts';
const ready={hasMonth:true,hasVersion:true,hasReviewedMonth:true,historyLoading:false,historyError:null,seriesStatus:'supported' as const,seriesFailure:null,financialMonths:3,financialIncomplete:[],acquisitionLoading:false,acquisitionError:false,result:{baseline:{} as any,months:[]}};
test('unselected month/version is a selection task, not a failed read or invented baseline',()=>{
 for(const selection of [{hasMonth:false,hasVersion:false},{hasMonth:true,hasVersion:false}]){const r=classifyPlanBaseline({...ready,...selection,hasReviewedMonth:false,result:null});assert.equal(r.kind,'selection-required');assert.equal(r.recovery,'select');assert.match(r.message,/two immediately preceding complete months/);}
});
test('financial loading and failed reads are distinguished from missing coverage and suppress cached baseline status',()=>{
 assert.equal(classifyPlanBaseline({...ready,historyLoading:true}).kind,'loading');
 assert.equal(classifyPlanBaseline({...ready,seriesStatus:'loading'}).kind,'loading');
 const failure=classifyPlanBaseline({...ready,historyError:'Selected version failed its read.'});assert.equal(failure.kind,'financial-read-failure');assert.equal(failure.recovery,'financial');assert.equal(failure.message,'Selected version failed its read.');
 assert.equal(classifyPlanBaseline({...ready,hasReviewedMonth:false}).kind,'financial-read-failure');
 assert.equal(classifyPlanBaseline({...ready,seriesStatus:'unavailable',seriesFailure:'read-or-reconciliation'}).kind,'financial-read-failure');
 const missing=classifyPlanBaseline({...ready,seriesStatus:'unavailable',seriesFailure:'coverage'});assert.equal(missing.kind,'missing-coverage');assert.match(missing.message,/unambiguous supported financial version/);
 assert.equal(classifyPlanBaseline({...ready,financialMonths:2}).kind,'missing-coverage');
});
test('partial financial costs remain their own problem rather than a customer error',()=>{
 const r=classifyPlanBaseline({...ready,financialIncomplete:['2026-08-01–2026-08-31'],acquisitionError:true});assert.equal(r.kind,'financial-incomplete');assert.equal(r.recovery,'financial');assert.match(r.message,/2026-08-01–2026-08-31/);assert.match(r.message,/Independently supported source amounts remain inspectable/);
});
test('acquisition loading, read failure, unsupported economics and combined rejection have distinct recovery messages',()=>{
 assert.equal(classifyPlanBaseline({...ready,acquisitionLoading:true}).kind,'loading');
 for(const failure of [{...ready,acquisitionError:true},{...ready,result:{baseline:null,months:[{state:'read-failed'} as any]}}]){const r=classifyPlanBaseline(failure);assert.equal(r.kind,'acquisition-read-failure');assert.equal(r.recovery,'acquisition');}
 const unsupported=classifyPlanBaseline({...ready,result:{baseline:null,months:[{state:'unsupported'} as any]}});assert.equal(unsupported.kind,'acquisition-unsupported');assert.equal(unsupported.recovery,'acquisition');
 const rejected=classifyPlanBaseline({...ready,result:{baseline:null,months:[{state:'supported'} as any,{state:'supported'} as any,{state:'supported'} as any]}});assert.equal(rejected.kind,'baseline-rejected');assert.match(rejected.message,/combined financial\/customer baseline/);
});
test('completed source records do not imply an accepted baseline until the baseline builder succeeds',()=>{
 assert.equal(classifyPlanBaseline({...ready,result:null}).kind,'loading');
 assert.equal(classifyPlanBaseline({...ready,result:{baseline:null,months:[]}}).kind,'baseline-rejected');
 assert.equal(classifyPlanBaseline(ready).kind,'supported');
});
test('one failed source row is visible as read failure even when other constituent rows passed',()=>{
 const rows=[{state:'supported'},{state:'read-failed'},{state:'supported'}] as any;const r=classifyPlanBaseline({...ready,result:{baseline:null,months:rows}});assert.equal(r.kind,'acquisition-read-failure');assert.match(r.message,/per-month result/);
});
test('the independent prior-year history failure does not invalidate a supported starting baseline',()=>{
 const withActualsFailure={...ready,actualsStatus:'unavailable',actualsError:'Comparison history read failed'};assert.equal(classifyPlanBaseline(withActualsFailure).kind,'supported');
});
test('the expected source window has exact calendar days, year rollover and fixed oldest-to-newest weights',()=>{
 assert.deepEqual(planEvidenceWindow('2025-01-01'),[{from:'2024-11-01',to:'2024-11-30',days:30,weight:1},{from:'2024-12-01',to:'2024-12-31',days:31,weight:2},{from:'2025-01-01',to:'2025-01-31',days:31,weight:3}]);
 assert.equal(planEvidenceWindow('2024-03-01')[1].days,29);assert.equal(planEvidenceWindow('2025-03-01')[1].days,28);
 for(const invalid of ['', '2025-02-30','2025-13-01','2025-02-02','not-a-month'])assert.deepEqual(planEvidenceWindow(invalid),[]);
});
