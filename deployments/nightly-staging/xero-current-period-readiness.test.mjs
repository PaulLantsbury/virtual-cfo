import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCurrentXeroPeriod} from './xero-current-period-readiness.mjs';
const env={NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED:'true',NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_XERO_PERIOD_MODE:'daily_completed_period',NIGHT_SCOUT_XERO_CURRENCY:'GBP',NIGHT_SCOUT_INTAKE_DATABASE_URL:'postgresql://night_scout_import_login:PRIVATEPASSWORD@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',NIGHT_SCOUT_STAGING_CA_PEM:`-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----`,NIGHT_SCOUT_XERO_CLIENT_ID:'12345678-1234-1234-1234-123456789abc',NIGHT_SCOUT_XERO_CLIENT_SECRET:'PRIVATESECRET'.repeat(3),NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY:'PRIVATEKEY'.repeat(5),NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION:'test-key'};
const clock=()=>new Date('2026-10-15T09:00:00Z');
function harness({identity={session_user:'night_scout_import_login',current_user:'night_scout_import_login',read_only:'on'},eligible=1,error,rollbackFails=false}={}){
 const calls=[];let released=0;
 const client={query:async(sql,params)=>{calls.push({sql,params});if(sql==='ROLLBACK'){if(rollbackFails)throw Error('PRIVATE rollback');return {rows:[]};}if(sql.includes('current_setting'))return {rows:[identity]};if(sql.includes('worker_get_single_refresh_job')){if(error)throw error;return {rows:[{eligible_jobs:eligible}]};}return {rows:[]};},release:()=>{released++;}};
 return {calls,releaseCount:()=>released,connect:async()=>client};
}
test('probes Thursday current period on one restricted READ ONLY transaction, then rolls back before returning eligibility',async()=>{
 const h=harness(),result=await inspectCurrentXeroPeriod({env,clock,connect:h.connect});
 assert.equal(result.state,'eligible');assert.deepEqual(result.scope,{from:'2026-10-01',to:'2026-10-14',currency:'GBP'});
 assert.equal(result.accountingCollected,false);assert.equal(result.connectionVerified,false);
 assert.equal(h.calls[0].sql,'BEGIN READ ONLY');assert.equal(h.calls.at(-1).sql,'ROLLBACK');assert.equal(h.releaseCount(),1);
 assert.deepEqual(h.calls.find(x=>x.sql.includes('worker_get_single_refresh_job')).params,['2026-10-01','2026-10-14','GBP',false]);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|postgresql|client|tenant|mapping|credential/i);
 assert.doesNotMatch(h.calls.map(x=>x.sql).join(' '),/acquire_refresh_lease|record_accounting|store_refresh|credential_refresh|UPDATE|INSERT|DELETE/i);
});
test('rejects fixed/legacy/stale-date configurations before opening the database',async()=>{
 for(const altered of [{...env,NIGHT_SCOUT_XERO_PERIOD_MODE:'fixed'},{...env,NIGHT_SCOUT_XERO_PERIOD_MODE:'completed_month_to_date'},{...env,NIGHT_SCOUT_XERO_REPORT_FROM:'2026-10-01',NIGHT_SCOUT_XERO_REPORT_TO:'2026-10-10'},{...env,NIGHT_SCOUT_RUNTIME_ENV:'production'}]){
  let connects=0;const result=await inspectCurrentXeroPeriod({env:altered,clock,connect:async()=>{connects++;throw Error('must not connect');}});assert.equal(result.state,'unavailable');assert.equal(connects,0);
 }
});
test('a retry attempting a write is refused, rolled back and never retried',async()=>{
 const h=harness({error:Object.assign(Error('PRIVATE FAILURE'),{code:'25006'})}),result=await inspectCurrentXeroPeriod({env,clock,connect:h.connect});
 assert.equal(result.reason,'retry_requires_review');assert.equal(h.calls.filter(x=>x.sql.includes('worker_get_single_refresh_job')).length,1);assert.equal(h.calls.at(-1).sql,'ROLLBACK');assert.equal(h.releaseCount(),1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});
test('refuses broad role, SET ROLE, writable transactions, multiple jobs and unconfirmed rollback',async()=>{
 for(const options of [{identity:{session_user:'postgres',current_user:'postgres',read_only:'on'}},{identity:{session_user:'night_scout_import_login',current_user:'postgres',read_only:'on'}},{identity:{session_user:'night_scout_import_login',current_user:'night_scout_import_login',read_only:'off'}},{eligible:2},{eligible:0},{rollbackFails:true}]){
  const h=harness(options),result=await inspectCurrentXeroPeriod({env,clock,connect:h.connect});assert.equal(result.state,'unavailable');assert.equal(h.calls.at(-1).sql,'ROLLBACK');assert.equal(h.releaseCount(),1);
 }
});
test('first London day probes prior complete month rather than replaying a fixed scope',async()=>{
 const h=harness(),result=await inspectCurrentXeroPeriod({env,clock:()=>new Date('2026-11-01T03:30:00Z'),connect:h.connect});assert.deepEqual(result.scope,{from:'2026-10-01',to:'2026-10-31',currency:'GBP'});
});
