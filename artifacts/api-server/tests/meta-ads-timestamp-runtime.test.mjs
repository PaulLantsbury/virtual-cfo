import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetaAdsReportRuntime} from '../src/lib/meta-ads-report-runtime.mjs';
const userId='11111111-1111-4111-8111-111111111111',storeId='22222222-2222-4222-8222-222222222222',connectionId='33333333-3333-4333-8333-333333333333';
const env={NIGHT_SCOUT_META_ADS_REPORT_RUNTIME_ENABLED:'true',NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_STAGING_CA_PEM:'-----BEGIN CERTIFICATE-----\nfictional\n-----END CERTIFICATE-----',NIGHT_SCOUT_REVIEW_AUTH_URL:'https://bioalckltvkhlczusdvl.supabase.co',NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'fictional-publishable-key-only-for-mock',NIGHT_SCOUT_META_ADS_STAGING_OWNER_ID:userId,NIGHT_SCOUT_META_ADS_STAGING_STORE_ID:storeId,NIGHT_SCOUT_META_ADS_REPORT_DATABASE_URL:'postgresql://night_scout_meta_ads_report_login:mock-password@db.bioalckltvkhlczusdvl.supabase.co:5432/postgres'};
test('actual report runtime rejects malformed source timestamps before normalization',async()=>{
 const fixture=()=>({provider_account_id:'123456',connection_id:connectionId,account_selection_id:storeId,selected_at:'2026-10-01T12:00:00.000001Z',connection_status:'connected',reauthorization_required:false,currency:'GBP',timezone_name:'Europe/London',spend_date:'2026-10-01',coverage_state:'provider_row',spend_minor:'1200',observed_at:'2026-10-02T09:00:00.123456Z',run_id:connectionId,run_status:'complete',run_started_at:'2026-10-02T08:59:00Z'});
 let row=fixture(),closed=0;
 const runtime=await createMetaAdsReportRuntime(env,{createPool:()=>({query:async sql=>sql.startsWith('SELECT session_user::text')?{rows:[{session_user:'night_scout_meta_ads_report_login',current_user:'night_scout_meta_ads_report_login'}]}:{rows:[row]},end:async()=>{closed++;}}),createAuthClient:()=>({auth:{getUser:async()=>({data:{user:{id:userId}},error:null})}}),fetchImpl:async()=>assert.fail('No external request')});
 const read=()=>runtime.service.readSpend({userId,isOwner:true},{storeId,from:'2026-10-01',to:'2026-10-01'});
 try{
  assert.equal((await read()).days[0].spendMinor,'1200');
  for(const key of ['observed_at','run_started_at','selected_at'])for(const value of ['2026-10-02T24:00:00.000000Z','2026-02-30T09:00:00.000000Z']){
   row=fixture();row[key]=value;await assert.rejects(read(),/unavailable/,`${key}: ${value}`);
  }
  row=fixture();row.observed_at='2026-10-02T10:00:00.123456+01:00';
  assert.equal((await read()).days[0].observedAt,'2026-10-02T09:00:00.123Z');
 }finally{await runtime.close();}
 assert.equal(closed,1);
});
