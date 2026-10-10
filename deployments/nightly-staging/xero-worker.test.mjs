import test from 'node:test';
import assert from 'node:assert/strict';
import {readStagingXeroWorkerConfig,runStagingXeroWorker} from './xero-worker.mjs';
const env=Object.freeze({NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED:'true',NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_XERO_STAGING_CONNECTION_ID:'11111111-1111-4111-8111-111111111111',NIGHT_SCOUT_XERO_STAGING_MAPPING_VERSION_ID:'22222222-2222-4222-8222-222222222222',NIGHT_SCOUT_XERO_REPORT_FROM:'2026-09-01',NIGHT_SCOUT_XERO_REPORT_TO:'2026-09-18',NIGHT_SCOUT_XERO_CURRENCY:'GBP',NIGHT_SCOUT_INTAKE_DATABASE_URL:'postgresql://night_scout_import_login:password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres',NIGHT_SCOUT_STAGING_CA_PEM:`-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----`,NIGHT_SCOUT_XERO_CLIENT_ID:'12345678-1234-1234-1234-123456789abc',NIGHT_SCOUT_XERO_CLIENT_SECRET:'x'.repeat(32),NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY:'y'.repeat(43),NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION:'staging-v1',NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON:JSON.stringify({revenue:'sales',processingFee:'fees',advertising:'ads',software:'software',includedCash:'cash'})});
test('pins every staging-only worker capability and returns no secret or database identifiers',()=>{const got=readStagingXeroWorkerConfig(env);assert.deepEqual(got,{envelopeKeyVersion:'staging-v1',scope:{from:'2026-09-01',to:'2026-09-18',currency:'GBP'},projectRef:'bioalckltvkhlczusdvl'});assert.doesNotMatch(JSON.stringify(got),/password|secret|yyyy|certificate|connection|mapping/i);});
test('rejects partial, production, wrong-target and broad configurations',()=>{for(const altered of [{},{...env,NIGHT_SCOUT_RUNTIME_ENV:'production'},{...env,NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'futkktdebdygsdrcknpr'},{...env,NIGHT_SCOUT_XERO_REPORT_TO:'2026-10-02'},{...env,NIGHT_SCOUT_INTAKE_DATABASE_URL:'postgres://postgres:password@db.bioalckltvkhlczusdvl.supabase.co/postgres'}])assert.throws(()=>readStagingXeroWorkerConfig(altered),/invalid/);});
test('rejects a future report end even when the bounded range is otherwise valid',()=>{const future={...env,NIGHT_SCOUT_XERO_REPORT_FROM:'2026-09-20',NIGHT_SCOUT_XERO_REPORT_TO:'2026-09-26'};assert.throws(()=>readStagingXeroWorkerConfig(future,()=>new Date('2026-09-25T23:59:59.999Z')),/invalid/);assert.equal(readStagingXeroWorkerConfig(future,()=>new Date('2026-09-26T00:00:00.000Z')).scope.to,'2026-09-26');});
test('delegates only a redacted receipt to the scheduled host',async()=>{const result=await runStagingXeroWorker({env,run:async config=>{assert.equal(config.projectRef,'bioalckltvkhlczusdvl');return {state:'supported',token:'private'};}});assert.deepEqual(result,{state:'supported',projectRef:'bioalckltvkhlczusdvl',scope:{from:'2026-09-01',to:'2026-09-18',currency:'GBP'}});await assert.rejects(runStagingXeroWorker({env,run:async()=>({state:'unknown'})}),/invalid/);});
test('rolling mode is explicit, London completed-day bounded and never overrides fixed dates',()=>{
 const rolling={...env,NIGHT_SCOUT_XERO_PERIOD_MODE:'completed_month_to_date',NIGHT_SCOUT_XERO_REPORT_FROM:undefined,NIGHT_SCOUT_XERO_REPORT_TO:undefined};
 assert.deepEqual(readStagingXeroWorkerConfig(rolling,()=>new Date('2026-10-09T16:00:00Z')).scope,{from:'2026-10-01',to:'2026-10-08',currency:'GBP'});
 assert.throws(()=>readStagingXeroWorkerConfig({...env,NIGHT_SCOUT_XERO_PERIOD_MODE:'completed_month_to_date'}),/invalid/);
 assert.throws(()=>readStagingXeroWorkerConfig({...rolling,NIGHT_SCOUT_XERO_PERIOD_MODE:'all_time'}),/invalid/);
 assert.throws(()=>readStagingXeroWorkerConfig(rolling,()=>new Date('2026-06-30T23:01:00Z')),/invalid/);
 assert.deepEqual(readStagingXeroWorkerConfig({...rolling,NIGHT_SCOUT_XERO_PERIOD_MODE:'last_complete_month'},()=>new Date('2026-06-30T23:01:00Z')).scope,{from:'2026-06-01',to:'2026-06-30',currency:'GBP'});
});
test('daily completed period finalizes the previous month then starts the new month without gaps or future dates',()=>{
 const daily={...env,NIGHT_SCOUT_XERO_PERIOD_MODE:'daily_completed_period',NIGHT_SCOUT_XERO_REPORT_FROM:undefined,NIGHT_SCOUT_XERO_REPORT_TO:undefined};
 const cases=[
  ['2026-10-31T03:30:00Z','2026-10-01','2026-10-30'],
  ['2026-11-01T03:30:00Z','2026-10-01','2026-10-31'],
  ['2026-11-02T03:30:00Z','2026-11-01','2026-11-01'],
  ['2026-03-31T23:05:00Z','2026-03-01','2026-03-31'],
  ['2026-10-01T00:05:00Z','2026-09-01','2026-09-30'],
  ['2027-01-01T03:30:00Z','2026-12-01','2026-12-31'],
  ['2028-03-01T03:30:00Z','2028-02-01','2028-02-29'],
 ];
 for(const [instant,from,to] of cases){
  const scope=readStagingXeroWorkerConfig(daily,()=>new Date(instant)).scope;
  assert.deepEqual(scope,{from,to,currency:'GBP'});assert.equal('closedPeriod' in scope,false);
 }
 for(const instant of ['2026-03-29T01:30:00Z','2026-10-25T01:30:00Z'])assert.equal(readStagingXeroWorkerConfig(daily,()=>new Date(instant)).scope.to,instant.slice(0,8)+String(Number(instant.slice(8,10))-1).padStart(2,'0'));
 assert.throws(()=>readStagingXeroWorkerConfig({...daily,NIGHT_SCOUT_XERO_REPORT_FROM:'2026-10-01'}),/invalid/);
 assert.throws(()=>readStagingXeroWorkerConfig({...daily,NIGHT_SCOUT_RUNTIME_ENV:'production'}),/invalid/);
});
