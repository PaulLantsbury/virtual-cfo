import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareBoundedProgramme, main, validWriterDatabaseIdentity } from './run-provider-test-programme.mjs';
test('six current bounded scenarios, distinct stable IDs, no missed-day/backdating replay', async()=>{
  const config={provider:'shopify',target:'dev.myshopify.com',startMonday:'2026-10-12',programmeKey:'shopify-staging-20261012'};
  const p=prepareBoundedProgramme(config);
  assert.equal(p.cap,6);assert.equal(p.endsAt,'2026-10-26T00:00:00.000Z');
  assert.deepEqual(p.plans.map(x=>x.date),['2026-10-12','2026-10-13','2026-10-17','2026-10-19','2026-10-20','2026-10-24']);
  assert.equal(new Set(p.plans.map(x=>x.plan.actionKey)).size,6);
  assert.equal(p.plans.every(x=>x.plan.variables.order.test===true && !('processedAt' in x.plan.variables.order)),true);
  assert.throws(()=>prepareBoundedProgramme({...config,startMonday:'2026-10-13'}));
  const dir=mkdtempSync(join(tmpdir(),'ns-provider-plan-')),file=join(dir,'config.json');
  try {
    writeFileSync(file,JSON.stringify(config));
    const env={NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE:file};
    assert.equal((await main({env})).state,'prepared-disabled');
    Object.assign(env,{NIGHT_SCOUT_TEST_PROGRAMME_ENABLED:'true',NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_TEST_PROGRAMME_TARGET:config.target,NIGHT_SCOUT_TEST_PROGRAMME_VERIFIED_TEST_TARGET:'true'});
    assert.equal((await main({env,now:new Date('2026-10-14T17:00:00Z')})).state,'no-mutation-day');
    assert.equal((await main({env,now:new Date('2026-10-13T17:16:00Z')})).state,'outside-generation-window');
    assert.equal((await main({env,now:new Date('2026-10-26T18:00:00Z')})).state,'outside-generation-window');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('posted mode is explicit bounded Xero configuration and separately gated at execution',async()=>{
 const config={provider:'xero',target:'90000000-0000-4000-8000-000000000002',startMonday:'2026-10-12',programmeKey:'xero-posted-20261012',contactId:'90000000-0000-4000-8000-000000000001',accountCode:'200',financialMode:'posted_demo_only'};
 const p=prepareBoundedProgramme(config);assert.equal(p.plans.length,6);assert.equal(p.plans.every(p=>p.plan.body.Invoices[0].Status==='AUTHORISED'),true);
 const dir=mkdtempSync(join(tmpdir(),'ns-posted-plan-')),file=join(dir,'config.json');try{
 writeFileSync(file,JSON.stringify(config));const env={NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE:file,NIGHT_SCOUT_TEST_PROGRAMME_ENABLED:'true',NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_TEST_PROGRAMME_TARGET:config.target,NIGHT_SCOUT_TEST_PROGRAMME_VERIFIED_TEST_TARGET:'true'};
 assert.equal((await main({env,now:new Date('2026-10-12T17:00:00Z')})).state,'configuration-or-provider-unavailable');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('actual database role capabilities reject inherited, privileged, wrong-login and extra memberships',()=>{
 const safe={rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,session_login:'night_scout_test_writer'};
 const roles=[{...safe,rolname:'night_scout_test_writer',rolcanlogin:true,rolconnlimit:3},{...safe,rolname:'night_scout_test_writer_service',rolcanlogin:false,rolconnlimit:-1}],membership=[{role_name:'night_scout_test_writer_service',member_name:'night_scout_test_writer',admin_option:false,inherit_option:false,set_option:true}];
 assert.equal(validWriterDatabaseIdentity(roles,membership),true);
 for(const key of ['rolsuper','rolinherit','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls'])assert.equal(validWriterDatabaseIdentity([{...roles[0],[key]:true},roles[1]],membership),false);
 assert.equal(validWriterDatabaseIdentity([{...roles[0],session_login:'postgres'},roles[1]],membership),false);
 assert.equal(validWriterDatabaseIdentity([{...roles[0],rolconnlimit:-1},roles[1]],membership),false);
 assert.equal(validWriterDatabaseIdentity(roles,[...membership,{role_name:'other'}]),false);
 assert.equal(validWriterDatabaseIdentity([roles[0],{...roles[1],rolcanlogin:true}],membership),false);
});
