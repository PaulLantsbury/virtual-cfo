import test from 'node:test';
import assert from 'node:assert/strict';
import {planCompletedXeroPeriods,skipEmptyXeroMonth} from './xero-completed-periods.mjs';
test('October preview supplies September and elapsed October independently, without authority or accounting closure',()=>{
 const plan=planCompletedXeroPeriods(new Date('2026-10-09T16:00:00Z'));
 assert.deepEqual(plan,{timezone:'Europe/London',today:'2026-10-09',applicationAuthorized:false,scopes:[{purpose:'last_complete_month',from:'2026-09-01',to:'2026-09-30',currency:'GBP'},{purpose:'current_month_completed_days',from:'2026-10-01',to:'2026-10-08',currency:'GBP'}]});
 assert.ok(Object.isFrozen(plan.scopes[0])); assert.doesNotMatch(JSON.stringify(plan),/closedPeriod|connectionId|mappingVersion/);
});
test('London month boundary excludes the new incomplete day and handles leap years',()=>{
 const march=planCompletedXeroPeriods(new Date('2028-03-01T00:00:00Z'));
 assert.equal(march.scopes.length,1);assert.equal(march.scopes[0].to,'2028-02-29');
 const summer=planCompletedXeroPeriods(new Date('2026-06-30T23:05:00Z'));
 assert.equal(summer.today,'2026-07-01');assert.equal(summer.scopes.length,1);assert.equal(summer.scopes[0].to,'2026-06-30');
 const winter=planCompletedXeroPeriods(new Date('2026-12-31T23:05:00Z'));
 assert.equal(winter.today,'2026-12-31');assert.equal(winter.scopes[1].to,'2026-12-30');
});
test('DST transitions use calendar days and reject invalid clocks',()=>{
 for(const instant of ['2026-03-29T01:30:00Z','2026-10-25T01:30:00Z']) {
  const plan=planCompletedXeroPeriods(new Date(instant));assert.equal(plan.scopes[1].to,instant.slice(0,8)+String(Number(instant.slice(8,10))-1).padStart(2,'0'));
 }
 assert.throws(()=>planCompletedXeroPeriods(new Date('invalid')));assert.throws(()=>planCompletedXeroPeriods('2026-10-09'));
});
test('only exact staging rolling configuration skips an empty local month',()=>{
 const env={NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_XERO_PERIOD_MODE:'completed_month_to_date'},first=new Date('2026-06-30T23:05:00Z');
 assert.equal(skipEmptyXeroMonth(env,first),true);assert.equal(skipEmptyXeroMonth(env,new Date('2026-07-02T02:00:00Z')),false);
 for(const changed of [{...env,NIGHT_SCOUT_RUNTIME_ENV:'production'},{...env,NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'other'},{...env,NIGHT_SCOUT_XERO_PERIOD_MODE:'fixed'},{...env,NIGHT_SCOUT_XERO_REPORT_FROM:'2026-06-01'}])assert.equal(skipEmptyXeroMonth(changed,first),false);
 assert.equal(skipEmptyXeroMonth({...env,NIGHT_SCOUT_XERO_PERIOD_MODE:'daily_completed_period'},first),false);
});
