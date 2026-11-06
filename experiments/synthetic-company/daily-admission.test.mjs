import test from 'node:test';import assert from 'node:assert/strict';
import {dailyAdmission} from './daily-admission.mjs';
import {stableId} from './staging-payload.mjs';
import {historySourceAsOf} from './history-context.mjs';
const input={initialThrough:'2026-11-04',throughDay:'2026-11-04',now:new Date('2026-11-06T02:00:00Z')};
test('fixed completed London cutoff is resolved once and disabled by default',()=>{
 const r=dailyAdmission(input);assert.equal(r.cutoff,'2026-11-05');assert.equal(r.sourceAsOf,'2026-11-06T00:00:00.000Z');assert.equal(r.state,'prepared-disabled');assert.equal(r.mutationAllowed,false);
 assert.equal(dailyAdmission({...input,operatorEnabled:true}).state,'eligible-for-reviewed-capability');
 assert.equal(dailyAdmission({...input,now:new Date('2026-11-06T01:00:00Z'),operatorEnabled:true}).state,'outside-london-window');
 assert.equal(dailyAdmission({...input,now:new Date('2026-11-06T02:15:00Z'),operatorEnabled:true}).state,'outside-london-window');
});
test('missed days and uncertain outcomes stop admission instead of automatic catchup',()=>{
 assert.equal(dailyAdmission({...input,now:new Date('2026-11-07T02:00:00Z'),operatorEnabled:true}).state,'gap-review');
 assert.equal(dailyAdmission({...input,uncertainOutcome:true,operatorEnabled:true}).state,'uncertain-review');
 const receipt={day:'2026-11-05',runId:stableId('history-daily-run','2024-11-01:2026-11-05'),sourceHash:'a'.repeat(64),sourceAsOf:historySourceAsOf('2026-11-05')};
 assert.equal(dailyAdmission({...input,throughDay:'2026-11-05',receipts:[receipt],operatorEnabled:true}).state,'already-recorded-inspect');
 for(const receipts of [[],[receipt,receipt],[{...receipt,sourceAsOf:'2026-11-06T02:00:00Z'}],[{...receipt,runId:'wrong'}]])assert.throws(()=>dailyAdmission({...input,throughDay:'2026-11-05',receipts}),/receipt|Receipt|Contiguous/);
});
test('UTC cron candidates admit exactly the 02:00 London invocation across DST changes',()=>{
 for(const [day,selected]of [['2026-03-29',1],['2026-10-25',2],['2026-07-01',1],['2026-12-01',2]]){
  const prior=new Date(`${day}T12:00:00Z`);prior.setUTCDate(prior.getUTCDate()-2);const through=prior.toISOString().slice(0,10);
  const states=[1,2].map(hour=>dailyAdmission({initialThrough:through,throughDay:through,now:new Date(`${day}T0${hour}:00:00Z`),operatorEnabled:true}));
  assert.equal(states.filter(r=>r.mutationAllowed).length,1,day);assert.equal(states[selected-1].mutationAllowed,true,day);
 }
});
